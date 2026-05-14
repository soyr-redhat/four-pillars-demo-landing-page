import { useEffect, type ReactElement } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SpeculativeDecodingPage } from './pages/SpeculativeDecodingPage';
import { QuantizationPage } from './pages/QuantizationPage';
import { SparsificationPage } from './pages/SparsificationPage';
import { PrefillDecodePage } from './pages/PrefillDecodePage';
import { PrefixCachingPage } from './pages/PrefixCachingPage';
import { ContinuousBatchingPage } from './pages/ContinuousBatchingPage';
import { PagedAttentionPage } from './pages/PagedAttentionPage';

const APP_ROUTES: { path: string; element: ReactElement }[] = [
  { path: '/', element: <HomePage /> },
  { path: '/demos/speculative-decoding', element: <SpeculativeDecodingPage /> },
  { path: '/demos/quantization', element: <QuantizationPage /> },
  { path: '/demos/sparsification', element: <SparsificationPage /> },
  { path: '/demos/prefill-decode', element: <PrefillDecodePage /> },
  { path: '/demos/prefix-caching', element: <PrefixCachingPage /> },
  { path: '/demos/continuous-batching', element: <ContinuousBatchingPage /> },
  { path: '/demos/paged-attention', element: <PagedAttentionPage /> },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {APP_ROUTES.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Routes>
    </>
  );
}
