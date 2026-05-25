export const metadata = {
  title: 'Chess Backend',
  description: 'Next.js API backend for Chess Arena'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
