/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Platform, StatusBar, Text, StyleSheet, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';

import { WebView } from 'react-native-webview';
import RNIap, {
  InAppPurchase,
  PurchaseError,
  SubscriptionPurchase,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import DeviceInfo from 'react-native-device-info';
import OneSignal from 'react-native-onesignal';
import dynamicLinks from '@react-native-firebase/dynamic-links';

let uniqueId = DeviceInfo.getUniqueId();

let purchaseUpdateSubscription;
let purchaseErrorSubscription;

const App: () => React$Node = () => {
  const [productsList, setProductsList] = useState(undefined);
  const [subscriptionsList, setSubscriptionsList] = useState(undefined);
  const [receipt, setReceipt] = useState(undefined);
  const [pendingPurchase, setPendingPurchase] = useState(undefined);
  const [isSubType, setIsSubType] = useState();
  const [isGetAvaliableProduct, setIsGetAvaliableProduct] = useState(undefined);
  const [userID, setUserID] = useState(undefined);
  const [dynamicLink, setDynamicLink] = useState(undefined);
  const webViewRef = useRef(null);

  const onReceived = notification => {
    console.log('Notification received: ', notification);
  };

  const onOpened = openResult => {
    console.log('Message: ', openResult.notification.payload.body);
    console.log('Data: ', openResult.notification.payload.additionalData);
    console.log('isActive: ', openResult.notification.isAppInFocus);
    console.log('openResult: ', openResult);
  };

  const onIds = device => {
    console.log('Device info: ', device);
    // userID = device.userId;
    setUserID(device.userId);
  };

  const handleDynamicLink = link => {
    setDynamicLink(link.url);
  };

  //eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(async () => {
    uniqueId = DeviceInfo.getUniqueId();

    if (Platform.OS === 'android') {
      getAvailablePurchases();
    }

    // This part for oneSignal notification
    OneSignal.init('c25f96fb-728f-4c0d-a183-8e445c62fbce', {
      kOSSettingsKeyAutoPrompt: false,
    });
    OneSignal.addEventListener('received', onReceived);
    OneSignal.addEventListener('opened', onOpened);
    OneSignal.addEventListener('ids', onIds);
    OneSignal.registerForPushNotifications();

    try {
      const result = await RNIap.initConnection();
      await RNIap.consumeAllItemsAndroid();
      console.log('result', result);
    } catch (err) {
      console.warn(err.code, err.message);
    }

    // firebase dynamicLinks
    const unsubscribe = dynamicLinks().onLink(handleDynamicLink);
    dynamicLinks()
      .getInitialLink()
      .then(link => {
        setDynamicLink(link.url);
      });

    // It will be work after successful purchase
    purchaseUpdateSubscription = purchaseUpdatedListener(async purchase => {
      const receipt = purchase.transactionReceipt;
      const productId = purchase.productId;
      if (receipt) {
        try {
          const receiptJson = receipt && JSON.parse(receipt);
          const isSubTypeFromReceipt = receiptJson?.productId?.includes("sub");
          if (isSubTypeFromReceipt) {
            const ackResult = await finishTransaction(purchase);
            console.log("isSubType", isSubType);
          } else {
            const ackResult = await finishTransaction(purchase, true);
          }
          sendRequestForPurchasesStatus(uniqueId, productId, 'OK', isSubType);
          setIsSubType(false);
          webViewRef?.current?.injectJavaScript(addCredit(productId));
        } catch (ackErr) {
          console.warn('ackErr', ackErr);
        }
        setReceipt({ receipt });
      }
    });
    // purchaseUpdateSubscription = purchaseUpdatedListener(
    //   async (purchase: InAppPurchase | SubscriptionPurchase) => {
    //     const receipt2 = purchase.transactionReceipt;
    //     if (receipt2) {
    //       try {
    //         // if (Platform.OS === 'ios') {
    //         //   finishTransactionIOS(purchase.transactionId);
    //         // } else if (Platform.OS === 'android') {
    //         //   // If consumable (can be purchased again)
    //         //   consumePurchaseAndroid(purchase.purchaseToken);
    //         //   // If not consumable
    //         //   acknowledgePurchaseAndroid(purchase.purchaseToken);
    //         // }
    //         const ackResult = await finishTransaction(purchase);
    //         Alert.alert('ackResult', JSON.stringify(ackResult));
    //     } catch (ackErr) {
    //         console.warn('ackErr', ackErr);
    //       }

    //       console.log('Receipt', JSON.stringify(receipt2));
    //     }
    //   },
    // );

    // It will be work after failed purchase
    purchaseErrorSubscription = purchaseErrorListener(async error => {
      if (error) {
        console.log('purchaseErrorListener', error);
        alert('Purchase error: ' + JSON.stringify(error.message));
        sendRequestForPurchasesStatus(uniqueId, '0', error.message, isSubType);
      }
    });

    // We have to delete all listener before close this page. like willUnMount
    return () => {
      unsubscribe();
      OneSignal.removeEventListener('received', this.onReceived);
      OneSignal.removeEventListener('opened', this.onOpened);
      OneSignal.removeEventListener('ids', this.onIds);
      // TODO : control
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
        purchaseUpdateSubscription = null;
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
        purchaseErrorSubscription = null;
      }
    };
  }, []);

  const sendRequestForPurchasesStatus = (
    uniqueId,
    productId,
    message,
    isSubType,
  ) => {
    let formdata = new FormData();
    formdata.append('uuid', uniqueId && uniqueId !== '' ? uniqueId : 'uuidrerror');
    formdata.append("id", productId)
    formdata.append("st", message)
    formdata.append("isSubType", isSubType)

    console.log(formdata);
    console.log(JSON.stringify(formdata));
    fetch('https://app.asktrology.com/paymentReceipt.php', {
      method: 'POST',
      body: formdata,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(response => {
      console.log(JSON.stringify(response));
    });
  };

  const getAvailablePurchases = async data => {
    try {
      let purchaseID = [];
      let subscriptionsID = [];
      let purchaseData = {
        Purchase: data.Purchase || data.purchase,
        Subscription: data.Subscription || data.subscription,
      };
      purchaseData?.Purchase?.map(item => purchaseID.push(item.id));
      purchaseData?.Subscription?.map(item => subscriptionsID.push(item.id));

      const products = purchaseID ? await RNIap.getProducts(purchaseID) : null;
      const subscriptions = subscriptionsID
        ? await RNIap.getSubscriptions(subscriptionsID)
        : null;
      console.log("products", products);
      console.log("subscriptions", subscriptions);
      setProductsList({ products });
      setSubscriptionsList({ subscriptions });
    } catch (err) {
      console.warn(err); // standardized err.code and err.message available
    }
  };
console.log(receipt);
  const openBrowser = async (url) => {
    // Checking if the link is supported for links with custom URL scheme.
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      // Opening the link with some app, if the URL scheme is "http" the web link should be opened
      // by some browser in the mobile
      await Linking.openURL(url);
    } else {
      alert(`Don't know how to open this URL: ${url}`);
    }
  };

  const handlePostMessageFromWebSite = data => {
    const parsedData = data == 'Fabric-Paket Sayfası' ? data : JSON.parse(data);
    let purchaseData = parsedData;

    if (parsedData.openBrowser) {
      openBrowser(parsedData.url);
    }
    // let purchaseData = JSON.parse(data);
    if (
      Platform.OS === 'android' &&
      purchaseData &&
      data !== 'Fabric-Paket Sayfası'
      // && !isGetAvaliableProduct
    ) {
      // purchaseData.productid = purchaseData.productid?.toLowerCase();
      purchaseData = data.toLowerCase();
      purchaseData = JSON.parse(purchaseData);
    }
    if (
      (purchaseData.Purchase ||
        purchaseData.Subscription || purchaseData.purchase ||
        purchaseData.subscription) &&
      !isGetAvaliableProduct
    ) {
      getAvailablePurchases(purchaseData);
      setIsGetAvaliableProduct(true);
    } else if (
      purchaseData &&
      (purchaseData.isSubType || purchaseData.issubtype)
    ) {
      requestSubscription(purchaseData.productid);
    } else if (
      purchaseData &&
      !purchaseData.isSubType &&
      purchaseData?.productid
    ) {
      requestPurchase(purchaseData.productid);
      // requestSubscription(purchaseData.productid);
    }
  };

  const requestSubscription = async productID => {
    try {
      setIsSubType(true);
      RNIap.requestSubscription(productID, false);
    } catch (err) {
      alert(err.code, err.message);
    }
  };

  const requestPurchase = async productID => {
    try {
      setIsSubType(false);
      RNIap.requestPurchase(productID, false);
    } catch (err) {
      alert(err.code, err.message);
    }
  };
  const addCredit = productID => `
    setTimeout(() => {
      window.addCredit("${productID?.toLowerCase()}");
    }, 100);
      true; // note: this is required, or you'll sometimes get silent failures
  `;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        style={styles.webViewStle}
        source={{
          uri: `${dynamicLink
              ? dynamicLink
              : 'https://app.asktrology.com/reacttest_index2.php'
            }?n=1&uid=${uniqueId}&pid=${userID}&version=v2`,
        }}
        onMessage={event => {
          handlePostMessageFromWebSite(event.nativeEvent.data);
        }}
      // injectedJavaScript={addCredit}
      />
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webViewStle: {
  },
});
