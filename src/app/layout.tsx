import "./globals.css";
import "katex/dist/katex.min.css";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const sans = IBM_Plex_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["500", "600"],
	variable: "--font-mono",
});

export const metadata = {
	title: "Precision SAT",
	description: "Local-first adaptive SAT practice",
	manifest: "/manifest.webmanifest",
	icons: { icon: "/icon.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={`${sans.variable} ${mono.variable}`}>
			<body>
				{children}
				<ServiceWorkerRegistration />
			</body>
		</html>
	);
}
