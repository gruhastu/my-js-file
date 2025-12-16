document.addEventListener('DOMContentLoaded', function() {
  console.log('Product JS loaded');
  // 👇 CONFIGURATION
  var EXTRA_VARIANT_ID = 44334658781254;
  var PALEMENT_VARIANT_ID = 44334658977862; // This should be a $1.00 product
  var PALEMENT_FIXED_HEIGHT = 4;
  var PALEMENT_PRICE_PER_SQFT = 500; // ✅ HARDCODED - Original price per sq ft for calculations
  var PALEMENT_MINIMUM_CHARGE = 500; // ✅ Minimum charge for palement

  // Get min/max values from window.CustomSizeConfig
  var config = window.CustomSizeConfig || {};
  var sectionId = config.sectionId || '';
  var productFormId = config.productFormId || '';
  var minHeight = config.minHeight || 0.1;
  var maxHeight = config.maxHeight || 1000;
  var minWidth = config.minWidth || 0.1;
  var maxWidth = config.maxWidth || 1000;
  var CURRENCY_SYMBOL = config.currencySymbol || '₹';
  var productTitle = config.productTitle || '';

  console.log('📏 Height constraints:', minHeight, '-', maxHeight);
  console.log('📏 Width constraints:', minWidth, '-', maxWidth);

  var minArea = minHeight * minWidth;
  console.log('📐 Minimum area:', minArea, 'in²');

  var form = document.querySelector('#' + productFormId);
  if (!form) return;

  var heightInput    = document.getElementById('custom-height-' + sectionId);
  var widthInput     = document.getElementById('custom-width-' + sectionId);
  var areaInput      = document.getElementById('custom-area-' + sectionId);
  var pricePreview   = document.getElementById('custom-price-preview-' + sectionId);
  var minimumWarning = document.getElementById('minimum-warning-' + sectionId);
  var palementWithRadio = document.getElementById('palement-with-' + sectionId);
  var palementWithoutRadio = document.getElementById('palement-without-' + sectionId);
  var palementPricePreview = document.getElementById('palement-price-preview-' + sectionId);

  var extraUnitPrice = null;
  var extraVariantLoaded = false;

  var submitButton = form.querySelector('.product-form__submit');
  var dynamicWrapper = form.querySelector('.shopify-payment-button');
  var dynamicButton = dynamicWrapper ? dynamicWrapper.querySelector('button') : null;

  // Set max attributes on inputs
  if (heightInput) {
    heightInput.max = maxHeight;
    heightInput.min = 0.01;
  }
  if (widthInput) {
    widthInput.max = maxWidth;
    widthInput.min = 0.01;
  }

  function formatPrice(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return CURRENCY_SYMBOL + ' 0.00';
    return CURRENCY_SYMBOL + ' ' + amount.toFixed(2);
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
    if (dynamicButton) {
      dynamicButton.disabled = invalid;
    }

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
      extraUnitPrice = parseFloat(data.price) / 100;
      extraVariantLoaded = true;
      console.log('✅ Extra variant loaded. Price per sq ft:', extraUnitPrice);
      updatePreview();
    })
    .catch(function(err) {
      console.error('❌ Error loading extra variant:', err);
    });

  function updatePreview() {
    var h = parseFloat(heightInput.value);
    var w = parseFloat(widthInput.value);

    if (!h || !w || h <= 0 || w <= 0) {
      if (pricePreview) pricePreview.textContent = '';
      if (areaInput) areaInput.value = '';
      if (minimumWarning) minimumWarning.style.display = 'none';
      if (palementPricePreview) palementPricePreview.style.display = 'none';
      return;
    }

    // Check if exceeds maximum
    if (h > maxHeight || w > maxWidth) {
      if (pricePreview) pricePreview.textContent = '';
      if (areaInput) areaInput.value = '';
      if (palementPricePreview) palementPricePreview.style.display = 'none';
      if (minimumWarning) {
        minimumWarning.style.display = 'block';
        minimumWarning.textContent = '⚠️ Exceeded maximum size! Height max: ' + maxHeight + '", Width max: ' + maxWidth + '"';
        minimumWarning.style.color = '#ff0000';
      }
      return;
    }

    var userAreaExact = h * w;
    var chargeableArea = userAreaExact;
    var isBelowMinimum = false;

    if (userAreaExact < minArea) {
      chargeableArea = minArea;
      isBelowMinimum = true;
      console.log('⚠️ User area (' + userAreaExact.toFixed(2) + ' in²) is below minimum. Will charge for ' + minArea.toFixed(2) + ' in²');
    }

    if (areaInput) {
      areaInput.value = userAreaExact.toFixed(2) + ' in²';
    }

    if (isBelowMinimum && minimumWarning) {
      minimumWarning.style.display = 'block';
      minimumWarning.style.color = '#ff6b00';
      minimumWarning.textContent = '⚠️ Your size (' + h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + userAreaExact.toFixed(2) + ' in²) is below minimum. You will be charged for the minimum size (' + minHeight.toFixed(2) + '" × ' + minWidth.toFixed(2) + '" = ' + minArea.toFixed(2) + ' in²)';
    } else if (minimumWarning) {
      minimumWarning.style.display = 'none';
    }

    var userAreaInSqFt = userAreaExact / 144;
    var chargeableAreaInSqFt = chargeableArea / 144;
    var chargeableAreaInSqFtRounded = Math.round(chargeableAreaInSqFt);

    if (extraVariantLoaded && extraUnitPrice) {
      var extraCharge = chargeableAreaInSqFtRounded * extraUnitPrice;
      if (pricePreview) {
        pricePreview.textContent =
          '💰 Custom cost (approx): ' + formatPrice(extraCharge) +
          ' — ' + h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + userAreaExact.toFixed(2) + ' in² (' + userAreaInSqFt.toFixed(2) + ' sq ft)' +
          (isBelowMinimum ? ' (charged as ' + minArea.toFixed(2) + ' in² / ' + (minArea / 144).toFixed(2) + ' sq ft)' : '');
      }
    } else {
      if (pricePreview) {
        pricePreview.textContent = h.toFixed(2) + '" × ' + w.toFixed(2) + '" = ' + userAreaExact.toFixed(2) + ' in² (' + userAreaInSqFt.toFixed(2) + ' sq ft)' +
          (isBelowMinimum ? ' (charged as ' + minArea.toFixed(2) + ' in² / ' + (minArea / 144).toFixed(2) + ' sq ft)' : '');
      }
    }

    updatePalementPreview();
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

  // ✅ UPDATED: Palement with MINIMUM CHARGE logic
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

    // ✅ Calculate cost
    var palementCostCalculated = palementAreaSqFt * PALEMENT_PRICE_PER_SQFT;
    
    // ✅ Apply minimum charge if below $500
    var palementCost = palementCostCalculated < PALEMENT_MINIMUM_CHARGE ? PALEMENT_MINIMUM_CHARGE : palementCostCalculated;
    var isPalementBelowMin = palementCostCalculated < PALEMENT_MINIMUM_CHARGE;

    if (palementPricePreview) {
      palementPricePreview.style.display = 'block';
      var previewText = '🏗️ Palement cost: ' + formatPrice(palementCost) +
        ' — ' + w.toFixed(2) + '" × ' + PALEMENT_FIXED_HEIGHT + '" = ' +
        palementAreaInches.toFixed(2) + ' in² (' + palementAreaSqFt.toFixed(2) + ' sq ft)';
      
      if (isPalementBelowMin) {
        previewText += ' (minimum charge: ' + formatPrice(PALEMENT_MINIMUM_CHARGE) + ')';
      }
      
      palementPricePreview.textContent = previewText;
    }

    console.log('💎 Palement:', w, '×', PALEMENT_FIXED_HEIGHT, '=', palementAreaInches, 'in²', '=', palementAreaSqFt.toFixed(2), 'sq ft', '×', PALEMENT_PRICE_PER_SQFT, '=', palementCostCalculated.toFixed(2), isPalementBelowMin ? '→ Minimum $' + PALEMENT_MINIMUM_CHARGE : '');
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

    var h = parseFloat(heightInput.value) || 0;
    var w = parseFloat(widthInput.value) || 0;

    console.log('Height:', h, 'Width:', w);

    if (h > maxHeight) {
      alert('Height cannot exceed ' + maxHeight.toFixed(2) + ' inches.');
      return;
    }

    if (w > maxWidth) {
      alert('Width cannot exceed ' + maxWidth.toFixed(2) + ' inches.');
      return;
    }

    if (!h || !w || h <= 0 || w <= 0) {
      alert('Please enter valid positive height and width in inches.');
      return;
    }

    var userAreaExact = h * w;
    var chargeableArea = userAreaExact;
    var isBelowMinimum = false;

    if (userAreaExact < minArea) {
      chargeableArea = minArea;
      isBelowMinimum = true;
      console.log('⚠️ Below minimum: User area = ' + userAreaExact.toFixed(2) + ' in², Charging for = ' + minArea.toFixed(2) + ' in²');
    }

    var chargeableAreaInSqFt = chargeableArea / 144;
    var chargeableAreaRounded = Math.round(chargeableAreaInSqFt);

    console.log('📐 User input area:', userAreaExact.toFixed(2), 'in²');
    console.log('📐 Chargeable area:', chargeableArea.toFixed(2), 'in² =', chargeableAreaInSqFt.toFixed(2), 'sq ft');
    console.log('📐 Rounded cart quantity:', chargeableAreaRounded, 'sq ft');

    if (chargeableAreaRounded <= 0) {
      alert('Please enter valid height and width.');
      return;
    }

    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    var syncTimestamp = hh + ':' + mm + ':' + ss;

    var mainVariantInput = form.querySelector('input[name="id"]');
    if (!mainVariantInput) {
      console.error('No main variant ID – submitting normally.');
      form.submit();
      return;
    }
    var mainVariantId = parseInt(mainVariantInput.value);

    var qtyInput = form.querySelector('input[name="quantity"]');
    var mainQty  = qtyInput ? parseInt(qtyInput.value || 1) : 1;
    if (!mainQty || mainQty < 1) mainQty = 1;

    var extraQty = chargeableAreaRounded * mainQty;

    var mainProperties = {};
    var formData = new FormData(form);
    formData.forEach(function(value, key) {
      var match = key.match(/^properties\[(.+)\]$/);
      if (match && match[1]) {
        mainProperties[match[1]] = value;
      }
    });

    mainProperties['Custom size enabled'] = 'Yes';
    mainProperties['Custom height (inches)'] = h.toFixed(2);
    mainProperties['Custom width (inches)']  = w.toFixed(2);
    mainProperties['Custom area (in²)']  = userAreaExact.toFixed(2);
    mainProperties['Custom area (sq ft)'] = (userAreaExact / 144).toFixed(2);
    mainProperties['_Sync time'] = syncTimestamp;

    if (isBelowMinimum) {
      mainProperties['_Charged as minimum'] = 'Yes (Minimum: ' + minHeight.toFixed(2) + '" × ' + minWidth.toFixed(2) + '" = ' + minArea.toFixed(2) + ' in²)';
      mainProperties['_Charged area (sq ft)'] = (minArea / 144).toFixed(2);
    } else {
      mainProperties['_Charged area (sq ft)'] = (chargeableArea / 144).toFixed(2);
    }

    var extraItem = {
      id: EXTRA_VARIANT_ID,
      quantity: extraQty,
      properties: {
        '_For product': productTitle,
        '_Custom height (inches)': h.toFixed(2),
        '_Custom width (inches)': w.toFixed(2),
        '_Custom area (in²)': userAreaExact.toFixed(2),
        '_Custom area (sq ft)': chargeableAreaInSqFt.toFixed(2),
        '_Charged area (in²)': chargeableArea.toFixed(2),
        '_Charged area (sq ft)': chargeableAreaInSqFt.toFixed(2),
        '_Qty rounded from': chargeableAreaInSqFt.toFixed(2) + ' sq ft',
        '_Sync time': syncTimestamp
      }
    };

    if (isBelowMinimum) {
      extraItem.properties['_Below minimum'] = 'Charged as minimum (' + minArea.toFixed(2) + ' in²)';
    }

    var mainItem = {
      id: mainVariantId,
      quantity: mainQty,
      properties: mainProperties
    };

    var payload = {
      items: [mainItem, extraItem]
    };

    // ✅ UPDATED: Palement with MINIMUM CHARGE logic
    if (palementWithRadio && palementWithRadio.checked) {
      var palementAreaInches = w * PALEMENT_FIXED_HEIGHT;
      var palementAreaSqFt = palementAreaInches / 144;
      
      // Calculate exact cost
      var palementCostCalculated = palementAreaSqFt * PALEMENT_PRICE_PER_SQFT;
      
      // ✅ Apply minimum charge
      var palementCostInDollars = palementCostCalculated < PALEMENT_MINIMUM_CHARGE ? PALEMENT_MINIMUM_CHARGE : palementCostCalculated;
      var isPalementBelowMinimum = palementCostCalculated < PALEMENT_MINIMUM_CHARGE;
      
      // Round to nearest dollar (quantity = dollar amount since variant is $1)
      var palementQtyAsDollars = Math.round(palementCostInDollars);

      if (palementQtyAsDollars > 0) {
        var palementItem = {
          id: PALEMENT_VARIANT_ID, // Must be $1.00 product
          quantity: palementQtyAsDollars * mainQty,
          properties: {
            '_For product': productTitle,
            '_Palement Details': w.toFixed(2) + '" × ' + PALEMENT_FIXED_HEIGHT + '" = ' + palementAreaInches.toFixed(2) + ' in² (' + palementAreaSqFt.toFixed(2) + ' sq ft)',
            '_Palement Qty Per Main': String(palementQtyAsDollars), // ✅ Store for cart sync
            '_Calculated Cost': formatPrice(palementCostInDollars),
            '_Sync time': syncTimestamp
          }
        };
        
        // ✅ Add minimum charge note if applicable
        if (isPalementBelowMinimum) {
          palementItem.properties['_Palement Minimum Charge'] = 'Yes (Calculated: ' + formatPrice(palementCostCalculated) + ', Charged: ' + formatPrice(PALEMENT_MINIMUM_CHARGE) + ' minimum)';
        }

        payload.items.push(palementItem);
        console.log('🏗️ Adding palement: ' + palementQtyAsDollars + ' units at $1 = $' + palementQtyAsDollars + (isPalementBelowMinimum ? ' (minimum charge applied)' : ''));
      }
    }

    console.log('🛒 Adding to cart:', payload);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      console.log('Response status:', res.status);
      return res.json();
    })
    .then(function(data) {
      console.log('✅ Cart response:', data);
      window.location.href = '/cart';
      showCartToast('✅ Item added to cart cmwsdofnjvo dfg');
    }) 
    .catch(function(err) {
      console.error('❌ Error adding items:', err);
      alert('Error adding to cart. Check console for details.');
    });
  }); 

  // Listen for variant changes and reset to minimum values
  if (form.querySelector('input[name="id"]')) {
    var variantInput = form.querySelector('input[name="id"]');

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