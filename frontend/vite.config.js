// // import { defineConfig, loadEnv } from 'vite';
// // import react from '@vitejs/plugin-react';

// // export default defineConfig(({ mode }) => {
// //   // Load env file from the current directory
// //   const env = loadEnv(mode, process.cwd(), '');
// //   const backendUrl = env.VITE_API_URL || 'http://node_api:5000';

// //   return {
// //     plugins: [react()],
// //     server: {
// //       proxy: {
// //         '/api': {
// //           target: backendUrl,
// //           changeOrigin: true,
// //           secure: false,
// //         },
// //         '/uploads': {
// //           target: backendUrl,
// //           changeOrigin: true,
// //           secure: false,
// //         }
// //       }
// //     }
// //   };
// // });



// import { defineConfig, loadEnv } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig(({ mode }) => {
//   // Load env file from the current directory
//   const env = loadEnv(mode, process.cwd(), '');
  
//   // Yahan 'node_api' ki jagah 'node_backend' karna hai (jo tere compose file me backend service ka naam hai)
//   const backendUrl = env.VITE_API_URL || 'http://node_backend:5000';

//   return {
//     plugins: [react()],
//     server: {
//       host: true, // Docker ke liye zaroori hai
//       port: 5173,
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
  
  // Docker Compose network में backend service name 'node_api:5000' है
  const backendUrl = process.env.BACKEND_URL || 'http://node_api:5000';

  return {
    plugins: [react()],
    server: {
      host: true, // Docker में बाहर से एक्सेस के लिए ज़रूरी
      port: 5173,
      watch: {
        usePolling: true, // 🔥 HOT-RELOAD FIX: Docker में फाइल सेव करते ही तुरंत चेंज डिटेक्ट करने के लिए
      },
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
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('@heroicons')) return 'vendor-icons';
              if (id.includes('framer-motion') || id.includes('react') || id.includes('redux')) return 'vendor-framework';
            }
          }
        }
      }
    }
  };
});
