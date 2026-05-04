import type { Metadata } from 'next'
import { Inter_Tight, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CRM FG Medios',
  description: 'CRM para agencias y freelancers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('crm-theme') || 'Sistema';
              var d = localStorage.getItem('crm-density') || '';
              if (t === 'Oscuro') document.documentElement.setAttribute('data-theme', 'dark');
              else if (t === 'Sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
                document.documentElement.setAttribute('data-theme', 'dark');
              if (d === 'Compacta') document.documentElement.setAttribute('data-density', 'compact');
              else if (d === 'Cómoda') document.documentElement.setAttribute('data-density', 'cozy');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className={`${interTight.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
