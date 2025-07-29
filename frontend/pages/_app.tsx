import '../styles/globals.css';
import 'tailwindcss/tailwind.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Scheherazade+New&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Toaster position="top-right" />
      <Component {...pageProps} />
    </>
  );
}
