// Razorpay checkout — renders the standard Razorpay Checkout via a tiny HTML payload
// inside a WebView (mobile) or iframe (web). After payment success Razorpay posts a
// message back to RN, the backend verifies the signature, and we close the modal.

import React, { useMemo } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { COLORS } from "../theme";

export type CheckoutOrder = {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan: string;
};

const buildHtml = (
  order: CheckoutOrder,
  user: { name?: string; email?: string }
) => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html,body{margin:0;padding:0;background:#060B19;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}
      .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:24px;text-align:center;}
      h1{font-size:22px;font-weight:800;margin:0 0 6px;}
      p{color:#9CA3AF;font-size:14px;margin:0;}
      .spinner{margin-top:20px;width:36px;height:36px;border-radius:50%;border:3px solid #232E4A;border-top-color:#10B981;animation:s 1s linear infinite;}
      @keyframes s{to{transform:rotate(360deg);}}
      button{margin-top:24px;background:#10B981;color:#060B19;border:none;border-radius:9999px;padding:14px 28px;font-weight:800;font-size:15px;}
    </style>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body>
    <div class="wrap">
      <h1>Loading Razorpay…</h1>
      <p>Secure checkout · ₹${(order.amount / 100).toFixed(0)} (${order.plan})</p>
      <div class="spinner"></div>
      <button id="retry" style="display:none" onclick="open()">Open checkout</button>
    </div>
    <script>
      function post(msg){
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        else if (window.parent) window.parent.postMessage(JSON.stringify(msg), '*');
      }
      function open() {
        var rzp = new Razorpay({
          key: ${JSON.stringify(order.key_id)},
          amount: ${order.amount},
          currency: ${JSON.stringify(order.currency)},
          name: "PaisaBachao",
          description: "Premium subscription · ${order.plan}",
          order_id: ${JSON.stringify(order.order_id)},
          theme: { color: "#10B981" },
          prefill: { name: ${JSON.stringify(user.name || "")}, email: ${JSON.stringify(user.email || "")} },
          handler: function (resp) { post({ type: "success", payload: resp }); },
          modal: { ondismiss: function(){ post({ type: "dismiss" }); } }
        });
        rzp.on('payment.failed', function (resp){ post({ type: "failed", payload: resp.error }); });
        rzp.open();
      }
      window.addEventListener('load', function(){
        setTimeout(open, 200);
        document.getElementById('retry').style.display = 'inline-block';
      });
    </script>
  </body>
</html>`;

export default function RazorpayCheckout({
  order,
  user,
  onResult,
}: {
  order: CheckoutOrder;
  user: { name?: string; email?: string };
  onResult: (r: { type: "success" | "failed" | "dismiss"; payload?: any }) => void;
}) {
  const html = useMemo(() => buildHtml(order, user), [order, user]);

  if (Platform.OS === "web") {
    // Inject HTML directly via iframe; postMessage listener
    React.useEffect(() => {
      const handler = (ev: MessageEvent) => {
        try {
          const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          if (data && (data.type === "success" || data.type === "failed" || data.type === "dismiss")) {
            onResult(data);
          }
        } catch {}
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [onResult]);

    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <iframe
          srcDoc={html}
          style={{ border: 0, width: "100%", height: "100%" }}
          title="Razorpay Checkout"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://checkout.razorpay.com" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loaderText}>Opening Razorpay…</Text>
          </View>
        )}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            onResult(data);
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.background,
  },
  loaderText: { color: COLORS.text_secondary },
});
