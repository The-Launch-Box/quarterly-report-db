import type mysql from "mysql2/promise"

import {
  buildCensus,
  CENSUS_FIRMS,
  MONTH_ENDS,
  type HeadcountCensus,
  type MonthCount,
  type TenureCount,
  type TurnoverCount,
} from "../src/data/headcount-census"
import { savedCensus } from "./headcount-snapshot"

const CACHE_MS = 10 * 60 * 1000
const QUERY_MS = 12_000

let pool: mysql.Pool | null = null
let cached: { at: number; census: HeadcountCensus } | null = null

export async function headcountCensus(): Promise<HeadcountCensus> {
  if (!configured()) return savedCensus
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.census
  try {
    const census = await withTimeout(queryHeadcountCensus(), QUERY_MS)
    cached = { at: Date.now(), census }
    return census
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.error(`BambooHR headcount query failed: ${message}`)
    return savedCensus
  }
}

export async function queryHeadcountCensus(): Promise<HeadcountCensus> {
  const db = await getPool()
  const divisions = CENSUS_FIRMS.map((firm) => firm.division)
  const monthSql = `
    SELECT e.division AS division, DATE_FORMAT(m.month_end, '%Y-%m') AS month, COUNT(*) AS headcount
    FROM (
      ${MONTH_ENDS.map(() => "SELECT CAST(? AS DATE) AS month_end").join(" UNION ALL ")}
    ) m
    JOIN bamboohr_ee_data e
      ON e.hire_date IS NOT NULL
     AND e.hire_date <= m.month_end
     AND (e.termination_date IS NULL OR e.termination_date > m.month_end)
     AND e.division IN (${divisions.map(() => "?").join(", ")})
    GROUP BY e.division, m.month_end
  `
  const tenureSql = `
    SELECT division,
      CASE
        WHEN DATEDIFF(termination_date, hire_date) < 183 THEN '< 6 months'
        WHEN DATEDIFF(termination_date, hire_date) < 365 THEN '6 months - 1 year'
        WHEN DATEDIFF(termination_date, hire_date) < 365 * 3 THEN '1-3 years'
        ELSE '3+ years'
      END AS label,
      COUNT(*) AS count
    FROM bamboohr_ee_data
    WHERE hire_date IS NOT NULL
      AND termination_date >= '2025-01-01'
      AND termination_date < '2026-01-01'
      AND division IN (${divisions.map(() => "?").join(", ")})
    GROUP BY division, label
  `
  const turnoverSql = `
    SELECT division, term_type AS termType, regrettable, COUNT(*) AS count
    FROM bamboo_turnover_data
    WHERE termination_date >= '2025-01-01'
      AND termination_date < '2026-01-01'
      AND division IN (${divisions.map(() => "?").join(", ")})
    GROUP BY division, term_type, regrettable
  `
  const [monthRows, tenureRows, turnoverRows] = await Promise.all([
    db.query(monthSql, [...MONTH_ENDS, ...divisions]),
    db.query(tenureSql, divisions),
    db.query(turnoverSql, divisions),
  ])
  return buildCensus(
    {
      months: rows(monthRows[0]).map((row) => ({
        division: text(row.division),
        month: text(row.month),
        headcount: asCount(row.headcount),
      })) satisfies MonthCount[],
      tenure: rows(tenureRows[0]).map((row) => ({
        division: text(row.division),
        label: text(row.label),
        count: asCount(row.count),
      })) satisfies TenureCount[],
      turnover: rows(turnoverRows[0]).map((row) => ({
        division: text(row.division),
        termType: nullableText(row.termType),
        regrettable: nullableText(row.regrettable),
        count: asCount(row.count),
      })) satisfies TurnoverCount[],
    },
    new Date().toISOString(),
    "live",
  )
}

function configured(): boolean {
  return Boolean(process.env.KTT_MYSQL_HOST && process.env.KTT_MYSQL_USER && process.env.KTT_MYSQL_PASSWORD)
}

async function getPool(): Promise<mysql.Pool> {
  if (pool) return pool
  const mysql = await import("mysql2/promise")
  pool = mysql.default.createPool({
    host: process.env.KTT_MYSQL_HOST,
    port: Number(process.env.KTT_MYSQL_PORT || 3306),
    user: process.env.KTT_MYSQL_USER,
    password: process.env.KTT_MYSQL_PASSWORD,
    database: "launchbox",
    connectTimeout: 8000,
    connectionLimit: 2,
    dateStrings: true,
    ssl: { rejectUnauthorized: false },
  })
  return pool
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value instanceof Date ? value.toISOString().slice(0, 7) : ""
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function asCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.round(numeric)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The headcount database timed out.")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error("The headcount database could not be queried."))
      },
    )
  })
}
