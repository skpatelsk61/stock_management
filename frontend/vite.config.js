// import { defineConfig, loadEnv } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig(({ mode }) => {
//   // Load env file from the current directory
//   const env = loadEnv(mode, process.cwd(), '');
//   const backendUrl = env.VITE_API_URL || 'http://node_api:5000';

//   return {
//     plugins: [react()],
//     server: {
//       proxy: {
//         '/api': {
//           target: backendUrl,
//           changeOrigin: true,
//           secure: false,
//         },
//         '/uploads': {
//           target: backendUrl,
//           changeOrigin: true,
//           secure: false,
//         }
//       }
//     }
//   };
// });



import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file from the current directory
  const env = loadEnv(mode, process.cwd(), '');
  
  // Yahan 'node_api' ki jagah 'node_backend' karna hai (jo tere compose file me backend service ka naam hai)
  const backendUrl = env.VITE_API_URL || 'http://node_backend:5000';

  return {
    plugins: [react()],
    server: {
      host: true, // Docker ke liye zaroori hai
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});