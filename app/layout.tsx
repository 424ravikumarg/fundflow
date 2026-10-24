import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AuthProvider } from "./context/AuthContext";
import { TimeframeProvider } from "./context/TimeframeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fundflow — Smart Cash Flow & Financial Intelligence",
  description: "Track, automate, and master your cash flow, subscriptions, and financial goals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F8F9FA] text-gray-900 antialiased`}>
        <AuthProvider>
          <CurrencyProvider>
            <TimeframeProvider>
              <div className="flex min-h-screen">
                {/* Persistent Sidebar */}
                <Sidebar />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                  {/* Connected Top Bar */}
                  <TopBar />

                  {/* Page Dynamic Content */}
                  <main className="flex-1 p-8">
                    {children}
                  </main>
                </div>
              </div>
            </TimeframeProvider>
          </CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
