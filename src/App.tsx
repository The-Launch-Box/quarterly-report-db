import { createBrowserRouter, Navigate, RouterProvider } from "react-router"

import { BoardPage } from "@/components/board-page"
import { Shell } from "@/components/shell"
import { WorkspaceProvider } from "@/data/store"

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/ytd" replace /> },
      { path: ":boardId", element: <BoardPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
