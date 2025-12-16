console.log('Cart Sync Manager Loaded');
 document.addEventListener('DOMContentLoaded', function () {
      var bulkRemoving = false;
      var updateQueue = [];
      var isProcessingQueue = false;
      var clickBlocked = false;
      var pendingMainUpdates = {};

      // Reference to the indicator element
      var activityIndicator = document.querySelector('.cart_template_hide');

      // Helper to update active state
      function updateActivityIndicator() {
        if (bulkRemoving || isProcessingQueue || clickBlocked || updateQueue.length > 0) {
          activityIndicator.classList.add('active');
        } else {
          activityIndicator.classList.remove('active');
        }
      }

      /* ==========================
        HELPERS FOR EXTRA PRICE DISPLAY
        ========================== */

      function getRowLinePriceText(row) {
        var totalsCell =
          row.querySelector('.cart-item__totals.right.small-hide') ||
          row.querySelector('.cart-item__totals.right.medium-hide.large-up-hide');

        if (!totalsCell) return null;

        var priceWrapper = totalsCell.querySelector('.cart-item__price-wrapper');
        if (!priceWrapper) return null;

        var prices = priceWrapper.querySelectorAll('.price--end');
        if (!prices.length) return null;

        var priceEl = prices[prices.length - 1];
        return priceEl.textContent.trim();
      }

      function addOrUpdateExtraPriceDisplay(mainRow, priceText) {
        ['.cart-item__totals.right.small-hide', '.cart-item__totals.right.medium-hide.large-up-hide'].forEach(function (
          sel
        ) {
          var totalsCell = mainRow.querySelector(sel);
          if (!totalsCell) return;

          var priceWrapper = totalsCell.querySelector('.cart-item__price-wrapper');
          if (!priceWrapper) return;

          var container = priceWrapper.querySelector('.cart-extra-price');
          if (!container) {
            container = document.createElement('p');
            container.className = 'cart-extra-price caption';
            priceWrapper.appendChild(container);
          }
          container.textContent = priceText;
        });
      }

      function updateGroupExtraPrices() {
        var rows = document.querySelectorAll('.cart-item[data-sync]');
        if (!rows.length) return;

        var groups = {};

        rows.forEach(function (row) {
          var sync = row.dataset.sync;
          if (!sync) return;

          if (!groups[sync]) {
            groups[sync] = { main: null, extraPriceText: null };
          }

          var isExtra = row.hasAttribute('data-plush-minus') || row.hasAttribute('data-palement-sqft');

          if (isExtra) {
            var priceText = getRowLinePriceText(row);
            if (priceText) {
              groups[sync].extraPriceText = priceText;
            }
          } else {
            if (!groups[sync].main) {
              groups[sync].main = row;
            }
          }
        });

        Object.keys(groups).forEach(function (sync) {
          var group = groups[sync];
          if (!group.main || !group.extraPriceText) return;
          addOrUpdateExtraPriceDisplay(group.main, group.extraPriceText);
        });
      }

      /* ==========================
      SUPPRESS ERROR DISPLAY — BULLETPROOF VERSION
      ========================== */
      function isGenericCartError(text) {
        if (!text) return false;
        var t = text.trim();
        return t === 'There was an error while updating your cart. Please try again.';
      }

      function clearCartErrors() {
        var errorDiv = document.getElementById('cart-errors');
        if (errorDiv) {
          errorDiv.textContent = '';
          errorDiv.innerHTML = '';
          errorDiv.style.display = 'none';
        }
      }

      var cartErrorObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            var errorDiv = document.getElementById('cart-errors');
            if (!errorDiv) return;

            var text = errorDiv.textContent || errorDiv.innerHTML || '';
            if (!text.trim()) return;

            if (isProcessingQueue || bulkRemoving || clickBlocked || isGenericCartError(text)) {
              clearCartErrors();
            }
          }
        });
      });

      var errorKiller = setInterval(function () {
        if (isProcessingQueue || bulkRemoving || clickBlocked) {
          clearCartErrors();
        }
      }, 100);

      cartErrorObserver.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      window.addEventListener('pagehide', function () {
        clearInterval(errorKiller);
        cartErrorObserver.disconnect();
      });

      document.addEventListener('click', function () {
        if (isProcessingQueue || bulkRemoving || clickBlocked) {
          setTimeout(clearCartErrors, 50);
        }
      });

      document.addEventListener('change', function () {
        if (isProcessingQueue || bulkRemoving || clickBlocked) {
          setTimeout(clearCartErrors, 50);
        }
      });

      /* ==========================
        GROUP REMOVE – UNBREAKABLE
        ========================== */
      /* ==========================
        GROUP REMOVE – GUARANTEED FINAL FIX
        ========================== */

        let groupRemoving = false;

        document.addEventListener('click', function (event) {
          const btn = event.target.closest('cart-remove-button a');
          if (!btn) return;

          const row = btn.closest('.cart-item');
          if (!row) return;

          const syncValue = row.dataset.sync;
          if (!syncValue) return;

          const groupRows = document.querySelectorAll(
            `.cart-item[data-sync="${syncValue}"]`
          );

          // Single item → default Shopify remove
          if (groupRows.length <= 1) return;

          event.preventDefault();
          event.stopPropagation();

          if (groupRemoving) return;
          groupRemoving = true;

          /* 🔥 SHOW LOADER */
          if (activityIndicator) {
            activityIndicator.classList.add('active');
          }

          console.log('REMOVING FULL GROUP:', syncValue, groupRows.length);

          const updates = {};

          groupRows.forEach(row => {
            const link = row.querySelector('cart-remove-button a');
            if (!link) return;

            const url = new URL(link.href, location.origin);
            const key = url.searchParams.get('id');
            updates[key] = 0;
          });

          fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
          })
          .then(() => {
            console.log('GROUP FULLY REMOVED:', syncValue);

            /* 🔄 RELOAD AFTER FULL GROUP REMOVE */
            window.location.reload();
          })
          .catch(err => {
            console.error('GROUP REMOVE FAILED', err);

            groupRemoving = false;

            /* ❌ HIDE LOADER IF FAILED */
            if (activityIndicator) {
              activityIndicator.classList.remove('active');
            }
          });

        }, true);



      /* ==========================
        BLOCK MULTIPLE CLICKS ON QTY BUTTONS
        ========================== */
      document.addEventListener('click', function (event) {
        var btn = event.target.closest('.quantity__button');
        if (!btn) return;

        if (clickBlocked) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Click blocked - update in progress');
          return;
        }

        var row = btn.closest('.cart-item');
        if (!row) return;

        var syncValue = row.dataset.sync;
        if (!syncValue) return;

        var groupRows = document.querySelectorAll('.cart-item[data-sync="' + syncValue + '"]');
        if (groupRows.length <= 1) return;

        // Block further clicks
        clickBlocked = true;
        console.log('🔒 Clicks blocked');

        // Safety unlock after 10 seconds
        setTimeout(function() {
          if (clickBlocked) {
            console.log('⚠️ Safety unlock - forced unblock');
            clickBlocked = false;
          }
        }, 10000);

        updateActivityIndicator();

        var input = row.querySelector('.quantity__input');
        if (input) {
          var previousQty = parseInt(input.value || '0', 10);
          var inputKey = syncValue + '-' + Date.now();
          
          pendingMainUpdates[inputKey] = {
            input: input,
            previousQty: previousQty,
            syncValue: syncValue,
            row: row,
            timestamp: Date.now()
          };
        }
      }, true);

      /* ==========================
        MONITOR MAIN ITEM CHANGES & SYNC OTHERS
        ========================== */
      document.addEventListener('change', function (event) {
        var input = event.target;
        
        if (!input.classList.contains('quantity__input')) return;

        var row = input.closest('.cart-item');
        if (!row) return;

        var syncValue = row.dataset.sync;
        if (!syncValue) {
          clickBlocked = false;
          updateActivityIndicator();
          return;
        }

        // NEW: If this is an extra item being changed manually → trigger active state
        var isExtraItem = row.hasAttribute('data-plush-minus') || row.hasAttribute('data-palement-sqft');
        if (isExtraItem) {
          updateActivityIndicator(); // Will add .active since a change is happening
        }

        var matchingUpdate = null;
        var matchingKey = null;

        Object.keys(pendingMainUpdates).forEach(function(key) {
          var update = pendingMainUpdates[key];
          if (update.input === input && update.syncValue === syncValue) {
            matchingUpdate = update;
            matchingKey = key;
          }
        });

        if (!matchingUpdate) {
          // Extra item change → let queue finish
          updateActivityIndicator();
          return;
        }

        var currentQty = parseInt(input.value || '0', 10);
        var previousQty = matchingUpdate.previousQty;

        if (currentQty === previousQty) {
          console.log('Main item did NOT update - aborting sync');
          delete pendingMainUpdates[matchingKey];
          clickBlocked = false;
          updateActivityIndicator();
          return;
        }

        console.log('Main item updated:', previousQty, '→', currentQty);

        var delta = currentQty - previousQty;

        var groupRows = document.querySelectorAll('.cart-item[data-sync="' + syncValue + '"]');
        if (groupRows.length <= 1) {
          delete pendingMainUpdates[matchingKey];
          clickBlocked = false;
          updateActivityIndicator();
          return;
        }

        updateQueue.push({
          syncValue: syncValue,
          mainRow: row,
          delta: delta
        });

        delete pendingMainUpdates[matchingKey];

        updateActivityIndicator();

        if (!isProcessingQueue) {
          setTimeout(processUpdateQueue, 200);
        }
      });

      /* ==========================
        PROCESS UPDATE QUEUE
        ========================== */
      function processUpdateQueue() {
        if (isProcessingQueue || updateQueue.length === 0) {
          clickBlocked = false;
          updateActivityIndicator();
          return;
        }

        isProcessingQueue = true;
        clearCartErrors();

        updateActivityIndicator();

        var batchedUpdates = {};

        while (updateQueue.length > 0) {
          var update = updateQueue.shift();
          var syncValue = update.syncValue;

          if (!batchedUpdates[syncValue]) {
            batchedUpdates[syncValue] = {
              mainRow: update.mainRow,
              netDelta: 0
            };
          }

          batchedUpdates[syncValue].netDelta += update.delta;
        }

        const syncGroups = Object.keys(batchedUpdates);
        var currentGroupIndex = 0;

        function processNextGroup() {
          if (currentGroupIndex >= syncGroups.length) {
            isProcessingQueue = false;
            clickBlocked = false;
            console.log('Clicks unblocked');
            updateActivityIndicator();
            setTimeout(function () {
              updateGroupExtraPrices();
              clearCartErrors();
            }, 300);
            return;
          }

          var syncValue = syncGroups[currentGroupIndex];
          var batch = batchedUpdates[syncValue];
          var mainRow = batch.mainRow;
          var netDelta = batch.netDelta;

          var groupRows = document.querySelectorAll('.cart-item[data-sync="' + syncValue + '"]');
          var rowsToUpdate = [];

          groupRows.forEach(function (r) {
            if (r === mainRow) return;

            var plushAttr = r.getAttribute('data-plush-minus');
            var palementAttr = r.getAttribute('data-palement-sqft');

            var stepValue = null;

            if (plushAttr) {
              stepValue = parseFloat(plushAttr);
            } else if (palementAttr) {
              stepValue = parseFloat(palementAttr);
            }

            if (stepValue === null || isNaN(stepValue)) return;

            var step = Math.round(stepValue);
            if (!step || step <= 0) return;

            var input = r.querySelector('.quantity__input');
            if (!input) return;

            var current = parseInt(input.value || '0', 10);
            var newQty = current + (step * netDelta);
            if (newQty < 0) newQty = 0;

            rowsToUpdate.push({
              input: input,
              newQty: newQty,
              currentQty: current
            });
          });

          var rowIndex = 0;

          function updateNextRow() {
            if (rowIndex >= rowsToUpdate.length) {
              currentGroupIndex++;
              setTimeout(processNextGroup, 400);
              return;
            }

            var item = rowsToUpdate[rowIndex];
            
            if (item.currentQty !== item.newQty) {
              item.input.value = item.newQty.toString();
              var changeEvent = new Event('change', { bubbles: true });
              item.input.dispatchEvent(changeEvent);
            }

            rowIndex++;
            setTimeout(updateNextRow, 700);
          }

          setTimeout(updateNextRow, 400);
        }

        processNextGroup();
      }

      /* ==========================
        CLEANUP OLD PENDING UPDATES
        ========================== */
      setInterval(function() {
        var now = Date.now();
        var hasStale = false;
        
        Object.keys(pendingMainUpdates).forEach(function(key) {
          var update = pendingMainUpdates[key];
          if (now - update.timestamp > 5000) {
            console.log('🧹 Cleaning up stale update:', key);
            delete pendingMainUpdates[key];
            hasStale = true;
          }
        });
        
        // Force unblock if we cleaned stale updates
        if (hasStale && Object.keys(pendingMainUpdates).length === 0) {
          console.log('🔓 Force unblock after cleanup');
          clickBlocked = false;
        }
      }, 1000);

      window.addEventListener('pagehide', () => {
        cartErrorObserver.disconnect();
      });

      // Initial
      updateGroupExtraPrices();
      updateActivityIndicator();
  });