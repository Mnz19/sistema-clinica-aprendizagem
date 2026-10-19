import { RouterProvider } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import router from "@/routes"
import PwaAvisos from "@/features/pwa/components/PwaAvisos"

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <PwaAvisos />
    </TooltipProvider>
  )
}
