document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const dropzoneTitle = document.getElementById('dropzone-title');
    const dropzoneDesc = document.getElementById('dropzone-desc');
    const fileBadge = document.getElementById('file-badge');
    const fileNameText = document.getElementById('file-name-text');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const locationInput = document.getElementById('location-input');
    const stockInput = document.getElementById('stock-input');
    const statsGrid = document.getElementById('stats-grid');
    const statProducts = document.getElementById('stat-products');
    const statVariants = document.getElementById('stat-variants');
    const statDuplicateSkus = document.getElementById('stat-duplicate-skus');
    const statMissingSkus = document.getElementById('stat-missing-skus');
    const alertBox = document.getElementById('alert-box');

    let selectedFile = null;
    let generatedCsvContent = null;
    let generatedFilename = 'inventory.csv';

    // Drag & Drop event handling
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFile();
    });

    function handleFileSelect(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showAlert('Please upload a valid CSV file (.csv)', 'error');
            return;
        }
        selectedFile = file;
        fileNameText.textContent = file.name;
        fileBadge.classList.remove('hidden');
        dropzoneTitle.textContent = 'File Ready for Processing';
        dropzoneDesc.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB (${file.name})`;
        convertBtn.disabled = false;
        hideAlert();
        downloadBtn.classList.add('hidden');
        statsGrid.classList.add('hidden');
    }

    function resetFile() {
        selectedFile = null;
        fileInput.value = '';
        fileBadge.classList.add('hidden');
        dropzoneTitle.textContent = 'Select or Drop Product CSV File';
        dropzoneDesc.innerHTML = 'Drag and drop your <code>products_export.csv</code> here, or <span class="browse-btn">Browse File</span>';
        convertBtn.disabled = true;
        downloadBtn.classList.add('hidden');
        statsGrid.classList.add('hidden');
        generatedCsvContent = null;
        hideAlert();
    }

    // Convert Product CSV to Inventory CSV
    convertBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        const locationName = locationInput.value.trim() || '74-09 37th Ave E';
        const stockQty = stockInput.value.trim() || '10';

        convertBtn.disabled = true;
        convertBtn.textContent = 'Processing CSV...';

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                try {
                    processShopifyProducts(results.data, locationName, stockQty);
                } catch (err) {
                    showAlert('Error processing CSV: ' + err.message, 'error');
                    convertBtn.disabled = false;
                    convertBtn.textContent = 'Generate Inventory CSV';
                }
            },
            error: function(err) {
                showAlert('PapaParse CSV Error: ' + err.message, 'error');
                convertBtn.disabled = false;
                convertBtn.textContent = 'Generate Inventory CSV';
            }
        });
    });

    function processShopifyProducts(rows, locationName, stockQty) {
        const handleMap = new Map();

        // 1. Group rows by Handle
        for (const row of rows) {
            const handle = row['Handle'];
            if (!handle) continue;
            if (!handleMap.has(handle)) {
                handleMap.set(handle, []);
            }
            handleMap.get(handle).push(row);
        }

        const inventoryRows = [];
        const skuTracker = new Map(); // Track SKU frequencies
        let missingSkuCount = 0;

        for (const [handle, hrows] of handleMap.entries()) {
            // Find Product Title & Option names from product-level rows
            const titleRow = hrows.find(r => r['Title'] && r['Title'].trim() !== '');
            const title = titleRow ? titleRow['Title'] : '';

            const opt1Row = hrows.find(r => r['Option1 Name'] && r['Option1 Name'].trim() !== '');
            let opt1Name = opt1Row ? opt1Row['Option1 Name'] : 'Title';

            const opt2Row = hrows.find(r => r['Option2 Name'] && r['Option2 Name'].trim() !== '');
            const opt2Name = opt2Row ? opt2Row['Option2 Name'] : '';

            const opt3Row = hrows.find(r => r['Option3 Name'] && r['Option3 Name'].trim() !== '');
            const opt3Name = opt3Row ? opt3Row['Option3 Name'] : '';

            for (const r of hrows) {
                let v1 = (r['Option1 Value'] || '').trim();
                const v2 = (r['Option2 Value'] || '').trim();
                const v3 = (r['Option3 Value'] || '').trim();
                const sku = (r['Variant SKU'] || '').trim();
                const price = (r['Variant Price'] || '').trim();

                // Ignore image-only rows (rows where option values, sku, and price are all blank)
                if (v1 || v2 || v3 || price || sku) {
                    if (!v1 && opt1Name === 'Title') {
                        v1 = 'Default Title';
                    }

                    // Track SKUs (missing vs duplicate)
                    if (sku) {
                        skuTracker.set(sku, (skuTracker.get(sku) || 0) + 1);
                    } else {
                        missingSkuCount++;
                    }

                    const invRow = {
                        'Handle': handle,
                        'Title': title,
                        'Option1 Name': opt1Name,
                        'Option1 Value': v1,
                        'Option2 Name': opt2Name,
                        'Option2 Value': v2,
                        'Option3 Name': opt3Name,
                        'Option3 Value': v3,
                        'SKU': sku,
                        'HS Code': '',
                        'COO': '',
                        [locationName]: stockQty
                    };

                    inventoryRows.push(invRow);
                }
            }
        }

        // Calculate duplicate SKUs count
        let duplicateSkuCount = 0;
        for (const [sku, count] of skuTracker.entries()) {
            if (count > 1) {
                duplicateSkuCount += (count - 1);
            }
        }

        // 2. Generate Shopify Inventory CSV with official header columns
        generatedCsvContent = Papa.unparse(inventoryRows, {
            columns: [
                'Handle',
                'Title',
                'Option1 Name',
                'Option1 Value',
                'Option2 Name',
                'Option2 Value',
                'Option3 Name',
                'Option3 Value',
                'SKU',
                'HS Code',
                'COO',
                locationName
            ]
        });

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        generatedFilename = `inventory_${dateStr}.csv`;

        // 3. Update Metrics Display
        statProducts.textContent = handleMap.size.toLocaleString();
        statVariants.textContent = inventoryRows.length.toLocaleString();
        statDuplicateSkus.textContent = duplicateSkuCount.toLocaleString();
        statMissingSkus.textContent = missingSkuCount.toLocaleString();

        statsGrid.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        convertBtn.disabled = false;
        convertBtn.textContent = 'Generate Inventory CSV';

        showAlert(`Successfully generated ${inventoryRows.length} variant inventory records for location "${locationName}"!`, 'success');
    }

    // Download inventory.csv button trigger
    downloadBtn.addEventListener('click', () => {
        if (!generatedCsvContent) return;

        const blob = new Blob([generatedCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', generatedFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    function showAlert(msg, type) {
        alertBox.textContent = msg;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
    }

    function hideAlert() {
        alertBox.classList.add('hidden');
    }
});
