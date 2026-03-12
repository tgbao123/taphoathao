import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarLayout } from "./SidebarLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "TapHoaThao — Quản lý Tạp Hoá",
  description: "Hệ thống quản lý cửa hàng tạp hoá & thể thao",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} antialiased`}>
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
