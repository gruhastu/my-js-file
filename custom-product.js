document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Custom Product JS loaded');
    // Get configuration from window object
    var config = window.CustomSizeConfig || {};
    var sectionId = config.sectionId || '';
    var CURRENCY = config.currencySymbol || '$';
    var productTitle = config.productTitle || '';
    var minHeight = config.minHeight || 0.1;
    var maxHeight = config.maxHeight || 1000;
    var minWidth = config.minWidth || 0.1;
    var maxWidth = config.maxWidth || 1000;
    
    var EXTRA_VARIANT_ID = 44334658879558;
    var PALEMENT_VARIANT_ID = 44334658977862;
    var PALEMENT_FIXED_HEIGHT = 4;
    var minArea = minHeight * minWidth;

    var form = document.querySelector('form[action="/cart/add"]');
    if (!form) return;

    var heightInput = document.querySelector('[data-custom-height]');
    var widthInput = document.querySelector('[data-custom-width]');
    var areaHidden = document.querySelector('[data-custom-area]');
    var priceHidden = document.querySelector('[data-custom-price]');
    var priceDisplay = document.querySelector('[data-custom-price-display]');
    var fileInput = document.querySelector('#custom-image-' + sectionId);
    var notesInput = document.getElementById('custom-notes');
    var palementWithRadio = document.getElementById('palement-with-' + sectionId);
    var palementWithoutRadio = document.getElementById('palement-without-' + sectionId);
    var palementPricePreview = document.getElementById('palement-price-preview-' + sectionId);
    var minimumWarning = document.getElementById('minimum-warning-' + sectionId);

    var extraUnitPrice = null;
    var palementUnitPrice = null;
    var palementVariantLoaded = false;
    var extraVariantLoaded = false;

    console.log('📏 Height constraints:', minHeight, '-', maxHeight);
    console.log('📏 Width constraints:', minWidth, '-', maxWidth);
    console.log('📐 Minimum area:', minArea, 'in²');

    // Set max/min attributes on inputs
    if (heightInput) {
        heightInput.max = maxHeight;
        heightInput.min = 0.01;
    }
    if (widthInput) {
        widthInput.max = maxWidth;
        widthInput.min = 0.01;
    }

    var submitButton = form.querySelector('.product-form__submit, button[type="submit"]');

    // Initialize Fabric.js canvas
    var canvas = null;
    var canvasElement = document.getElementById('custom-canvas-' + sectionId);
    
    function initCanvas() {
        if (typeof fabric !== 'undefined' && canvasElement) {
            // Get parent container width
            var parentWidth = canvasElement.parentElement.offsetWidth;
            
            // Set canvas size to match parent (square aspect ratio)
            var canvasSize = parentWidth;
            
            // Set the actual canvas element dimensions
            canvasElement.width = canvasSize;
            canvasElement.height = canvasSize;
            
            // Initialize Fabric canvas
            canvas = new fabric.Canvas('custom-canvas-' + sectionId, {
                width: canvasSize,
                height: canvasSize
            });
            
            canvas.backgroundColor = '#ffffff';
            canvas.renderAll();
            
            console.log('✅ Canvas initialized with size:', canvasSize + 'x' + canvasSize);
            
            // Handle window resize to keep canvas responsive
            var resizeTimeout;
            window.addEventListener('resize', function() {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function() {
                    var newParentWidth = canvasElement.parentElement.offsetWidth;
                    var newSize = newParentWidth;
                    
                    // Update canvas dimensions
                    canvas.setDimensions({
                        width: newSize,
                        height: newSize
                    });
                    
                    canvasElement.width = newSize;
                    canvasElement.height = newSize;
                    
                    // Re-render canvas content
                    canvas.renderAll();
                    
                    console.log('📐 Canvas resized to:', newSize + 'x' + newSize);
                }, 250);
            });
        } else {
            console.log('⏳ Waiting for Fabric.js...');
            setTimeout(initCanvas, 100);
        }
    }

    initCanvas();

    // Handle image upload and display on canvas
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (file && file.type.match('image.*')) {
                var reader = new FileReader();
                reader.onload = function(event) {
                    if (!canvas) {
                        console.error('Canvas not initialized');
                        return;
                    }
                    
                    fabric.Image.fromURL(event.target.result, function(img) {
                        // Clear canvas
                        canvas.clear();
                        canvas.backgroundColor = '#ffffff';
                        
                        // Scale image to fit canvas while maintaining aspect ratio
                        var scale = Math.min(
                            canvas.width / img.width,
                            canvas.height / img.height
                        ) * 0.95; // 95% to add some padding
                        
                        img.scale(scale);
                        
                        // Center image on canvas
                        img.set({
                            left: canvas.width / 2,
                            top: canvas.height / 2,
                            originX: 'center',
                            originY: 'center'
                        });
                        
                        canvas.add(img);
                        canvas.renderAll();
                        
                        console.log('✅ Image loaded on canvas');
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function formatPrice(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return CURRENCY + ' 0.00';
        return CURRENCY + ' ' + amount.toFixed(2);
    }

    // Prefill inputs with minimum values
    function prefillMinimumValues() {
        if (heightInput && !heightInput.value) {
            heightInput.value = minHeight.toFixed(2);
        }
        if (widthInput && !widthInput.value) {
            widthInput.value = minWidth.toFixed(2);
        }
        updatePreview();
        updateButtonsState();
    }

    function updateButtonsState() {
        if (!submitButton) return;

        var h = parseFloat(heightInput && heightInput.value);
        var w = parseFloat(widthInput && widthInput.value);

        var invalid = (!h || !w || h <= 0 || w <= 0 || h > maxHeight || w > maxWidth);

        submitButton.disabled = invalid;

        if (invalid) {
            submitButton.style.opacity = '0.5';
            submitButton.style.cursor = 'not-allowed';
        } else {
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        }
    }

    // Load extra variant price
    fetch('/variants/' + EXTRA_VARIANT_ID + '.js')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            extraUnitPrice = data.price / 100;
            extraVariantLoaded = true;
            console.log('Extra variant loaded. Price per sq ft:', extraUnitPrice);
            updatePreview();
        })
        .catch(function(err) {
            console.warn('Could not load extra variant price', err);
            updatePreview();
        });

    // Load palement variant price
    fetch('/variants/' + PALEMENT_VARIANT_ID + '.js')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            palementUnitPrice = 500;
            palementVariantLoaded = true;
            console.log('Palement variant loaded. Price per sq ft:', palementUnitPrice);
            updatePalementPreview();
        })
        .catch(function(err) {
            console.error('Error loading Palement variant:', err);
        });

    function updatePalementPreview() {
        if (!palementWithRadio || !palementWithRadio.checked) {
            if (palementPricePreview) palementPricePreview.style.display = 'none';
            return;
        }

        var w = parseFloat(widthInput.value);
        if (!w || w <= 0) {
            if (palementPricePreview) palementPricePreview.style.display = 'none';
            return;
        }

        var palementAreaInches = w * PALEMENT_FIXED_HEIGHT;
        var palementAreaSqFt = palementAreaInches / 144;

        // NEW CALCULATION - Since variant is now $1, multiply area by unit price to get total cost
        var palementCost = palementVariantLoaded && palementUnitPrice
            ? palementAreaSqFt * palementUnitPrice  // This calculates the actual dollar amount
            : 0;

        if (palementPricePreview) {
            palementPricePreview.style.display = 'block';
            if (!palementVariantLoaded) {
                palementPricePreview.innerHTML = '<strong>Palement cost:</strong> Loading… — ' + 
                    w.toFixed(2) + '" × ' + PALEMENT_FIXED_HEIGHT + '" = ' +
                    palementAreaInches.toFixed(2) + ' in² (' + palementAreaSqFt.toFixed(2) + ' sq ft)';
            } else {
                palementPricePreview.innerHTML = '<strong>Palement cost:</strong> ' + formatPrice(palementCost) +
                    ' — ' + w.toFixed(2) + '" × ' + PALEMENT_FIXED_HEIGHT + '" = ' +
                    palementAreaInches.toFixed(2) + ' in² (' + palementAreaSqFt.toFixed(2) + ' sq ft)';
            }
        }
    }

    function showCartToast(message) {
        var toast = document.getElementById('cart-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
        }, 3000);
    }

    function updatePreview() {
        if (!heightInput || !widthInput) return;

        var h = parseFloat(heightInput.value);
        var w = parseFloat(widthInput.value);

        if (!h || !w || h <= 0 || w <= 0) {
            if (priceDisplay) {
                priceDisplay.textContent = "Custom cost (approx.): Enter dimensions to calculate";
            }
            if (areaHidden) areaHidden.value = "";
            if (priceHidden) priceHidden.value = "";
            if (palementPricePreview) palementPricePreview.style.display = 'none';
            if (minimumWarning) minimumWarning.style.display = 'none';
            return;
        }

        // Check if exceeds maximum
        if (h > maxHeight || w > maxWidth) {
            if (priceDisplay) priceDisplay.textContent = '';
            if (areaHidden) areaHidden.value = '';
            if (palementPricePreview) palementPricePreview.style.display = 'none';
            if (minimumWarning) {
                minimumWarning.style.display = 'block';
                minimumWarning.textContent = '⚠️ Exceeded maximum size! Height max: ' + maxHeight + '", Width max: ' + maxWidth + '"';
                minimumWarning.style.color = '#ff0000';
            }
            return;
        }

        var userAreaExact = h * w;
        var userAreaInSqFt = userAreaExact / 144;

        var chargeableArea = userAreaExact;
        var isBelowMinimum = false;
        if (minArea && userAreaExact < minArea) {
            chargeableArea = minArea;
            isBelowMinimum = true;
            console.log('⚠️ User area (' + userAreaExact.toFixed(2) + ' in²) is below minimum. Will charge for ' + minArea.toFixed(2) + ' in²');
        }

        var chargeableAreaInSqFt = chargeableArea / 144;
        var chargeableAreaInSqFtRounded = Math.round(chargeableAreaInSqFt);

        if (areaHidden) areaHidden.value = userAreaExact.toFixed(2);

        // Show warning if below minimum
        if (isBelowMinimum && minimumWarning) {
            minimumWarning.style.display = 'block';
            minimumWarning.style.color = '#ff6b00';
            minimumWarning.textContent = '⚠️ Your size (' + h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + userAreaExact.toFixed(2) + ' in²) is below minimum. You will be charged for the minimum size (' + minHeight.toFixed(2) + '" × ' + minWidth.toFixed(2) + '" = ' + minArea.toFixed(2) + ' in²)';
        } else if (minimumWarning) {
            minimumWarning.style.display = 'none';
        }

        if (extraVariantLoaded && extraUnitPrice && priceDisplay && priceHidden) {
            var extraTotal = chargeableAreaInSqFtRounded * extraUnitPrice;
            priceHidden.value = extraTotal.toFixed(2);
            
            var displayText = 'Custom cost (approx.): ' + formatPrice(extraTotal) + 
                ' — ' + h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + 
                userAreaExact.toFixed(2) + ' in² (' + userAreaInSqFt.toFixed(2) + ' sq ft)';
            
            if (isBelowMinimum) {
                displayText += ' (charged as minimum: ' + minArea.toFixed(2) + ' in² / ' + 
                            (minArea / 144).toFixed(2) + ' sq ft)';
            }
            
            priceDisplay.textContent = displayText;
        } else if (priceDisplay) {
            var displayText = 'Custom cost (approx.): Calculating... — ' + 
                h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + 
                userAreaExact.toFixed(2) + ' in² (' + userAreaInSqFt.toFixed(2) + ' sq ft)';
            
            if (isBelowMinimum) {
                displayText += ' (charged as minimum: ' + minArea.toFixed(2) + ' in² / ' + (minArea / 144).toFixed(2) + ' sq ft)';
            }
            
            priceDisplay.textContent = displayText;
        }

        updatePalementPreview();
    }

    if (heightInput) {
        heightInput.addEventListener('input', function() {
            updatePreview();
            updateButtonsState();
        });
        heightInput.addEventListener('blur', function() {
            var value = parseFloat(heightInput.value);
            if (value > maxHeight) {
                alert('Height cannot exceed ' + maxHeight.toFixed(2) + ' inches.');
                heightInput.value = maxHeight.toFixed(2);
                updatePreview();
                updateButtonsState();
            }
        });
    }

    if (widthInput) {
        widthInput.addEventListener('input', function() {
            updatePreview();
            updateButtonsState();
        });
        widthInput.addEventListener('blur', function() {
            var value = parseFloat(widthInput.value);
            if (value > maxWidth) {
                alert('Width cannot exceed ' + maxWidth.toFixed(2) + ' inches.');
                widthInput.value = maxWidth.toFixed(2);
                updatePreview();
                updateButtonsState();
            }
        });
    }

    if (palementWithRadio) {
        palementWithRadio.addEventListener('change', updatePalementPreview);
    }
    if (palementWithoutRadio) {
        palementWithoutRadio.addEventListener('change', updatePalementPreview);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!heightInput || !widthInput) {
            form.submit();
            return;
        }

        var h = parseFloat(heightInput.value);
        var w = parseFloat(widthInput.value);

        // Validate against maximum
        if (h > maxHeight) {
            alert('Height cannot exceed ' + maxHeight.toFixed(2) + ' inches.');
            return;
        }
        if (w > maxWidth) {
            alert('Width cannot exceed ' + maxWidth.toFixed(2) + ' inches.');
            return;
        }

        if (!h || !w || h <= 0 || w <= 0) {
            alert("Enter valid height and width.");
            return;
        }

        var userAreaExact = h * w;
        var userAreaInSqFt = userAreaExact / 144;

        var chargeableArea = userAreaExact;
        var isBelowMinimum = false;
        if (minArea && userAreaExact < minArea) {
            chargeableArea = minArea;
            isBelowMinimum = true;
            console.log('⚠️ Below minimum: User area = ' + userAreaExact.toFixed(2) + ' in², Charging for = ' + minArea.toFixed(2) + ' in²');
        }

        var chargeableAreaInSqFt = chargeableArea / 144;
        var chargeableAreaInSqFtRounded = Math.round(chargeableAreaInSqFt);
        if (chargeableAreaInSqFtRounded <= 0) chargeableAreaInSqFtRounded = 1;

        var mainVariantInput = form.querySelector('input[name="id"]');
        var mainVariantId = mainVariantInput ? mainVariantInput.value : null;
        var qtyInput = form.querySelector('input[name="quantity"]');
        var mainQty = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;

        if (!mainVariantId) {
            console.error('No main variant ID found');
            form.submit();
            return;
        }

        var now = new Date();
        var syncTimestamp = now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0') + ':' +
                        now.getSeconds().toString().padStart(2, '0');

        var file = fileInput && fileInput.files && fileInput.files[0];
        var fd = new FormData();

        // Main item
        fd.append('items[0][id]', mainVariantId);
        fd.append('items[0][quantity]', String(mainQty));
        fd.append('items[0][properties][Custom size enabled]', 'Yes');
        fd.append('items[0][properties][Custom height (inches)]', h.toFixed(2));
        fd.append('items[0][properties][Custom width (inches)]', w.toFixed(2));
        fd.append('items[0][properties][Custom area (in²)]', userAreaExact.toFixed(2));
        fd.append('items[0][properties][Custom area (sq ft)]', userAreaInSqFt.toFixed(2));
        fd.append('items[0][properties][_Sync time]', syncTimestamp);
        
        if (notesInput && notesInput.value.trim()) {
            fd.append('items[0][properties][Customization Notes]', notesInput.value.trim());
        }
        
        if (isBelowMinimum) {
            fd.append('items[0][properties][_Charged as minimum]', 
                'Yes (Minimum: ' + minHeight.toFixed(2) + '" × ' + minWidth.toFixed(2) + '" = ' + minArea.toFixed(2) + ' in²)');
            fd.append('items[0][properties][_Charged area (sq ft)]', (minArea / 144).toFixed(2));
        } else {
            fd.append('items[0][properties][_Charged area (sq ft)]', chargeableAreaInSqFt.toFixed(2));
        }
        
        if (priceHidden && priceHidden.value) {
            fd.append('items[0][properties][Calculated Price]', priceHidden.value);
        }
        
        if (file) {
            fd.append('items[0][properties][Custom Upload]', file, file.name);
        }

        // Extra item
        var extraQty = chargeableAreaInSqFtRounded * mainQty;
        fd.append('items[1][id]', EXTRA_VARIANT_ID);
        fd.append('items[1][quantity]', String(extraQty));
        fd.append('items[1][properties][_For product]', productTitle);
        fd.append('items[1][properties][_Custom height (inches)]', h.toFixed(2));
        fd.append('items[1][properties][_Custom width (inches)]', w.toFixed(2));
        fd.append('items[1][properties][_Custom area (in²)]', userAreaExact.toFixed(2));
        fd.append('items[1][properties][_Custom area (sq ft)]', userAreaInSqFt.toFixed(2));
        fd.append('items[1][properties][_Charged area (in²)]', chargeableArea.toFixed(2));
        fd.append('items[1][properties][_Charged area (sq ft)]', chargeableAreaInSqFt.toFixed(2));
        fd.append('items[1][properties][_Qty rounded from]', chargeableAreaInSqFt.toFixed(2) + ' sq ft');
        fd.append('items[1][properties][_Sync time]', syncTimestamp);
        
        if (isBelowMinimum) {
            fd.append('items[1][properties][_Below minimum]', 
                'Charged as minimum (' + minArea.toFixed(2) + ' in²)');
        }

        // Palement item if selected
        if (palementWithRadio && palementWithRadio.checked) {
            var palementAreaInches = w * PALEMENT_FIXED_HEIGHT;
            var palementAreaSqFt = palementAreaInches / 144;
            
            // Calculate exact palement cost in dollars
            var palementCostInDollars = palementVariantLoaded && palementUnitPrice 
                ? palementAreaSqFt * palementUnitPrice 
                : 0;
            
            // Round to nearest whole dollar (since variant is $1, quantity = total price)
            var palementQtyAsDollars = Math.round(palementCostInDollars);
            
            if (palementQtyAsDollars > 0) {
                fd.append('items[2][id]', PALEMENT_VARIANT_ID); // Must be a $1.00 product
                fd.append('items[2][quantity]', String(palementQtyAsDollars)); // e.g., 1083
                fd.append('items[2][properties][_For product]', productTitle);
                fd.append('items[2][properties][_Palement Details]', 
                    w.toFixed(2) + '" × ' + PALEMENT_FIXED_HEIGHT + '" = ' + 
                    palementAreaInches.toFixed(2) + ' in² (' + palementAreaSqFt.toFixed(2) + ' sq ft)');
                fd.append('items[2][properties][_Palement Qty Per Main]', String(palementQtyAsDollars));
                fd.append('items[2][properties][_Calculated Cost]', formatPrice(palementCostInDollars));
                fd.append('items[2][properties][_Sync time]', syncTimestamp);
                
                console.log('🏗️ Adding palement: ' + palementQtyAsDollars + ' units at $1 = $' + palementQtyAsDollars);
            }
        }

        console.log('🛒 Submitting cart...');

        fetch('/cart/add.js', {
            method: 'POST',
            body: fd,
            headers: { 'Accept': 'application/json' }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Network response not ok');
            return res.json();
        })
        .then(function(data) {
            console.log('✅ Cart response:', data);
            showCartToast('✅ Item added to cart');
        })
        .catch(function(err) {
            console.error('Error adding items:', err);
            alert('Error adding to cart. Please try again.');
        });
    });

    // Listen for variant changes and reset to minimum values
    var variantInput = form.querySelector('input[name="id"]');
    if (variantInput) {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    console.log('🔄 Variant changed - resetting to minimum values');
                    prefillMinimumValues();
                }
            });
        });

        observer.observe(variantInput, {
            attributes: true,
            attributeFilter: ['value']
        });
    }

    // Initial prefill and updates
    prefillMinimumValues();
    updateButtonsState();

    setTimeout(function() {
        prefillMinimumValues();
        updateButtonsState();
    }, 150);

    window.addEventListener('load', function() {
        prefillMinimumValues();
        updateButtonsState();
    });
});