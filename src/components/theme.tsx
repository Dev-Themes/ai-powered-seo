'use client';
import {ThemeProvider,useTheme} from 'next-themes';import {Sun,Moon} from 'lucide-react';
export function Theme({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider>;}
export function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme();return <button type="button" className="theme-toggle icon-button" aria-label="Toggle colour theme" title="Toggle light and dark theme" onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')}><Sun className="theme-sun" size={20}/><Moon className="theme-moon" size={20}/></button>;}
