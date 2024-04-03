const path = require('path');

module.exports = {
  mode: 'production', // or 'production'
  entry: './scripts/content.js', // Your main JS file
  output: {
    path: path.resolve(__dirname, 'build'), // Output directory
    filename: 'content.js' // Output file
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Apply this rule to JavaScript files
        exclude: /node_modules/, // Don't transpile npm packages
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'] // Use this preset for babel
          }
        }
      },
      {
        test: /\.css$/, // Apply this rule to CSS files
        use: ['style-loader', 'css-loader'] // Use these loaders for CSS files
      }
    ]
  }
};
