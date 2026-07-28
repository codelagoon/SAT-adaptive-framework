import "./globals.css";
import "katex/dist/katex.min.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
export const metadata={title:"Precision SAT",description:"Local-first adaptive SAT practice",manifest:"/manifest.webmanifest",icons:{icon:"/icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<ServiceWorkerRegistration/></body></html>}
