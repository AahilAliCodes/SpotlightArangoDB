// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
      // This is necessary to handle the ArcGIS dependencies
      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules(\/|\\)@arcgis(\/|\\)core/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-class-properties']
          }
        }
      });
      return config;
    }
  };
  
  module.exports = nextConfig;