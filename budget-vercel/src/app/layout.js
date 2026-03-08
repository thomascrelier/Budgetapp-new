import './globals.css';
import ThemeProvider from '../components/ThemeProvider';
import AuthProvider from '@/components/AuthProvider';

export const metadata = {
  title: 'Budget Tracker',
  description: 'Personal finance tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var saved = localStorage.getItem('theme');
            var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
          })();
        `}} />
      </head>
      <body className="font-sans grain bg-background text-text-primary">
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
