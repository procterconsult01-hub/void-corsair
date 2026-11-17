/* Google Play Billing bridge for Void Corsair.
   Uses cordova-plugin-purchase (CdvPurchase v13), which runs inside Capacitor.
   In a normal browser there is no `cordova`, so Billing.native is false and the
   game falls back to demo coin packs. */
(function () {
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var store = null, ready = false, coinMap = {}, onGrant = function () {};

  // Optional: your server endpoint that verifies Play purchase tokens.
  // Leave empty to accept the device's own verification.
  var VALIDATOR_URL = '';

  function setup() {
    if (!window.CdvPurchase) { console.warn('CdvPurchase not found'); return; }
    var C = window.CdvPurchase;
    store = C.store;
    store.verbosity = C.LogLevel.WARNING;
    if (VALIDATOR_URL) store.validator = VALIDATOR_URL;

    store.register(Object.keys(coinMap).map(function (id) {
      return { id: id, type: C.ProductType.CONSUMABLE, platform: C.Platform.GOOGLE_PLAY };
    }));

    store.when()
      .approved(function (tx) { tx.verify(); })
      .verified(function (receipt) {
        // Grant coins once per verified transaction, then consume it
        // so the player can buy the same pack again.
        (receipt.sourceReceipt.transactions || []).forEach(function (tx) {
          if (tx.state === C.TransactionState.FINISHED) return;
          (tx.products || []).forEach(function (p) {
            var n = coinMap[p.id];
            if (n) onGrant(n);
          });
        });
        receipt.finish();
      });

    store.error(function (e) { console.warn('Store error', e && e.code, e && e.message); });

    store.initialize([C.Platform.GOOGLE_PLAY]).then(function () { ready = true; });
  }

  window.Billing = {
    native: isNative,
    ready: function () { return ready; },
    init: function (map, grant) {
      coinMap = map; onGrant = grant;
      if (!isNative) return;
      if (window.CdvPurchase) setup();
      else document.addEventListener('deviceready', setup, false);
    },
    price: function (id) {
      if (!store) return '';
      var p = store.get(id, window.CdvPurchase.Platform.GOOGLE_PLAY);
      return (p && p.pricing && p.pricing.price) || '';
    },
    order: function (id) {
      var p = store && store.get(id, window.CdvPurchase.Platform.GOOGLE_PLAY);
      var offer = p && p.getOffer();
      if (!offer) return Promise.reject(new Error('Product not available: ' + id));
      return store.order(offer).then(function (err) { if (err) throw err; });
    }
  };
})();
