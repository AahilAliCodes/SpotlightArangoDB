/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@arcgis/core'],
    webpack: (config) => {
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