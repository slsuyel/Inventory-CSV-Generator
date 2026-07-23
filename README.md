# Inventory-CSV-Generator

A lightweight, 100% client-side web application to convert Shopify **Product CSV** export files into Shopify **Inventory Import CSV** files mapped by SKU & Location.

## 🚀 Features

- 📤 **Client-Side CSV Upload**: Drag and drop your Shopify `products_export.csv` file directly into your browser.
- ⚡ **Zero Backend Required**: Runs 100% locally in your web browser using PapaParse.
- 🚫 **Ignores Image Rows**: Excludes image-only rows and extracts valid product variants.
- 📍 **Custom Location & Stock**: Easily configure Location Name and Stock Quantity.
- 📊 **Real-Time Analytics**: View counts for Total Products, Total Variants, Duplicate SKUs, and Missing SKUs.
- 📥 **Instant Download**: Download `inventory.csv` ready for Shopify Admin import.

## 🌐 Deploy to GitHub Pages / Vercel / Netlify

This repository contains pure HTML, CSS, and JS files (`index.html`, `style.css`, `app.js`). You can deploy it for free:
- **GitHub Pages**: Go to Repository **Settings** > **Pages** > Select `main` branch > **Save**.
- **Vercel / Netlify**: Connect this GitHub repository for instant static hosting.
