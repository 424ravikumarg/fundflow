import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AuthProvider } from "./context/AuthContext";

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
            <div className="flex min-h-screen">
              {/* Persistent Sidebar */}
              <Sidebar />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <header className="px-8 py-3.5 flex justify-between items-center border-b border-gray-100 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Workspace:
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      Personal Vault
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <select className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#6558D3]/30">
                      <option>All time</option>
                      <option>This Month</option>
                      <option>Last Month</option>
                      <option>This Year</option>
                    </select>
                  </div>
                </header>

                {/* Page Dynamic Content */}
                <main className="flex-1 p-8">
                  {children}
                </main>
              </div>
            </div>
          </CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
