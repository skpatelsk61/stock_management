import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TopProgressBar = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Start progress immediately on route change
    setVisible(true);
    setProgress(30);

    const timer1 = setTimeout(() => {
      setProgress(70);
    }, 100);

    const timer2 = setTimeout(() => {
      setProgress(100);
    }, 250);

    const timer3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [location.pathname, location.search]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <div
        className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '150ms' : '200ms',
        }}
      />
    </div>
  );
};

export default TopProgressBar;
