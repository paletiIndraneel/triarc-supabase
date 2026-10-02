"use client";

import EVBilling from "./EVBilling";
import { ToastProvider } from "@/components/BillingToast";
import styles from "./billing.module.css";

export default function BillingPage() {
  return (
    <div className={styles.billingScope}>
      <ToastProvider>
        <EVBilling />
      </ToastProvider>
    </div>
  );
}
