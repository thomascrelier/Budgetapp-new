import './globals.css';
import AuthProvider from '@/components/AuthProvider';

export const metadata = {
  title: 'Budget Tracker',
  description: 'Personal finance management with Google Sheets',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
