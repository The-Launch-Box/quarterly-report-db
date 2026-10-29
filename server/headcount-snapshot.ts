import type { HeadcountCensus } from "../src/data/headcount-census"

/** BambooHR extract used when the report server cannot reach RDS. */
export const savedCensus: HeadcountCensus = {
  "year": 2025,
  "asOf": "2026-10-29T21:28:03.377Z",
  "source": "snapshot",
  "firms": [
    {
      "id": "echelon",
      "name": "Echelon Risk + Cyber",
      "months": [
        {
          "label": "Jan",
          "headcount": 53
        },
        {
          "label": "Feb",
          "headcount": 50
        },
        {
          "label": "Mar",
          "headcount": 52
        },
        {
          "label": "Apr",
          "headcount": 51
        },
        {
          "label": "May",
          "headcount": 58
        },
        {
          "label": "Jun",
          "headcount": 58
        },
        {
          "label": "Jul",
          "headcount": 60
        },
        {
          "label": "Aug",
          "headcount": 56
        },
        {
          "label": "Sep",
          "headcount": 56
        },
        {
          "label": "Oct",
          "headcount": 53
        },
        {
          "label": "Nov",
          "headcount": 54
        },
        {
          "label": "Dec",
          "headcount": 55
        }
      ],
      "termination": [
        {
          "label": "Involuntary Termination",
          "count": 10,
          "share": 44
        },
        {
          "label": "Voluntary Unspecified",
          "count": 2,
          "share": 9
        },
        {
          "label": "Non-Regrettable",
          "count": 1,
          "share": 4
        },
        {
          "label": "Regrettable",
          "count": 6,
          "share": 26
        },
        {
          "label": "Unclassified",
          "count": 4,
          "share": 17
        }
      ],
      "tenure": [
        {
          "label": "1-3 years",
          "count": 11,
          "share": 50
        },
        {
          "label": "6 months - 1 year",
          "count": 3,
          "share": 14
        },
        {
          "label": "< 6 months",
          "count": 8,
          "share": 36
        }
      ]
    },
    {
      "id": "improv",
      "name": "Improv",
      "months": [
        {
          "label": "Jan",
          "headcount": 22
        },
        {
          "label": "Feb",
          "headcount": 21
        },
        {
          "label": "Mar",
          "headcount": 22
        },
        {
          "label": "Apr",
          "headcount": 20
        },
        {
          "label": "May",
          "headcount": 20
        },
        {
          "label": "Jun",
          "headcount": 24
        },
        {
          "label": "Jul",
          "headcount": 28
        },
        {
          "label": "Aug",
          "headcount": 28
        },
        {
          "label": "Sep",
          "headcount": 34
        },
        {
          "label": "Oct",
          "headcount": 31
        },
        {
          "label": "Nov",
          "headcount": 29
        },
        {
          "label": "Dec",
          "headcount": 31
        }
      ],
      "termination": [],
      "tenure": [
        {
          "label": "1-3 years",
          "count": 4,
          "share": 27
        },
        {
          "label": "6 months - 1 year",
          "count": 3,
          "share": 20
        },
        {
          "label": "< 6 months",
          "count": 8,
          "share": 53
        }
      ]
    },
    {
      "id": "hyperscayle",
      "name": "Hyperscayle",
      "months": [
        {
          "label": "Jan",
          "headcount": 19
        },
        {
          "label": "Feb",
          "headcount": 17
        },
        {
          "label": "Mar",
          "headcount": 17
        },
        {
          "label": "Apr",
          "headcount": 17
        },
        {
          "label": "May",
          "headcount": 17
        },
        {
          "label": "Jun",
          "headcount": 16
        },
        {
          "label": "Jul",
          "headcount": 16
        },
        {
          "label": "Aug",
          "headcount": 17
        },
        {
          "label": "Sep",
          "headcount": 17
        },
        {
          "label": "Oct",
          "headcount": 16
        },
        {
          "label": "Nov",
          "headcount": 16
        },
        {
          "label": "Dec",
          "headcount": 18
        }
      ],
      "termination": [],
      "tenure": [
        {
          "label": "1-3 years",
          "count": 4,
          "share": 80
        },
        {
          "label": "6 months - 1 year",
          "count": 1,
          "share": 20
        }
      ]
    },
    {
      "id": "vescape",
      "name": "VEscape",
      "months": [
        {
          "label": "Jan",
          "headcount": 7
        },
        {
          "label": "Feb",
          "headcount": 6
        },
        {
          "label": "Mar",
          "headcount": 6
        },
        {
          "label": "Apr",
          "headcount": 6
        },
        {
          "label": "May",
          "headcount": 4
        },
        {
          "label": "Jun",
          "headcount": 3
        },
        {
          "label": "Jul",
          "headcount": 2
        },
        {
          "label": "Aug",
          "headcount": 2
        },
        {
          "label": "Sep",
          "headcount": 2
        },
        {
          "label": "Oct",
          "headcount": 3
        },
        {
          "label": "Nov",
          "headcount": 3
        },
        {
          "label": "Dec",
          "headcount": 2
        }
      ],
      "termination": [],
      "tenure": [
        {
          "label": "1-3 years",
          "count": 4,
          "share": 57
        },
        {
          "label": "6 months - 1 year",
          "count": 2,
          "share": 29
        },
        {
          "label": "< 6 months",
          "count": 1,
          "share": 14
        }
      ]
    },
    {
      "id": "bluetrail",
      "name": "Blue Trail Digital",
      "months": [
        {
          "label": "Jan",
          "headcount": 5
        },
        {
          "label": "Feb",
          "headcount": 10
        },
        {
          "label": "Mar",
          "headcount": 5
        },
        {
          "label": "Apr",
          "headcount": 5
        },
        {
          "label": "May",
          "headcount": 6
        },
        {
          "label": "Jun",
          "headcount": 6
        },
        {
          "label": "Jul",
          "headcount": 6
        },
        {
          "label": "Aug",
          "headcount": 6
        },
        {
          "label": "Sep",
          "headcount": 6
        },
        {
          "label": "Oct",
          "headcount": 6
        },
        {
          "label": "Nov",
          "headcount": 6
        },
        {
          "label": "Dec",
          "headcount": 6
        }
      ],
      "termination": [],
      "tenure": [
        {
          "label": "< 6 months",
          "count": 5,
          "share": 100
        }
      ]
    },
    {
      "id": "dxfoundation",
      "name": "DX Foundation",
      "months": [
        {
          "label": "Jan",
          "headcount": 6
        },
        {
          "label": "Feb",
          "headcount": 6
        },
        {
          "label": "Mar",
          "headcount": 7
        },
        {
          "label": "Apr",
          "headcount": 6
        },
        {
          "label": "May",
          "headcount": 6
        },
        {
          "label": "Jun",
          "headcount": 7
        },
        {
          "label": "Jul",
          "headcount": 6
        },
        {
          "label": "Aug",
          "headcount": 7
        },
        {
          "label": "Sep",
          "headcount": 6
        },
        {
          "label": "Oct",
          "headcount": 6
        },
        {
          "label": "Nov",
          "headcount": 6
        },
        {
          "label": "Dec",
          "headcount": 6
        }
      ],
      "termination": [],
      "tenure": [
        {
          "label": "< 6 months",
          "count": 4,
          "share": 100
        }
      ]
    }
  ]
}
