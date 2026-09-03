import { useState } from "react";
import { apiClient } from "@/src/api/client";
import { AxiosError } from "axios";

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (method: "get" | "post" | "put" | "delete", url: string, payload?: any) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient[method](url, payload);
      setData(res.data);
      return res.data;
    } catch (err) {
      const message = (err as AxiosError).response?.data?.detail || "Erreur API";
      setError(message as string);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, request };
}
