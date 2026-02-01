import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PricingSetting {
  id: string;
  setting_key: string;
  setting_value: number;
  description: string | null;
}

export interface PricingSettings {
  travel_free_minutes: number;
  travel_interval_minutes: number;
  travel_fee_per_interval: number;
  early_hour_threshold: number;
  early_hour_fee: number;
  late_hour_threshold: number;
  late_hour_fee: number;
  same_day_fee: number;
  sunday_fee: number;
}

const defaultSettings: PricingSettings = {
  travel_free_minutes: 20,
  travel_interval_minutes: 20,
  travel_fee_per_interval: 10,
  early_hour_threshold: 10,
  early_hour_fee: 5,
  late_hour_threshold: 20,
  late_hour_fee: 5,
  same_day_fee: 5,
  sunday_fee: 10,
};

export const usePricingSettings = () => {
  return useQuery({
    queryKey: ["pricing-settings"],
    queryFn: async (): Promise<PricingSettings> => {
      const { data, error } = await supabase
        .from("pricing_settings")
        .select("*");

      if (error) {
        console.error("Error fetching pricing settings:", error);
        return defaultSettings;
      }

      const settings = { ...defaultSettings };
      data?.forEach((item: PricingSetting) => {
        if (item.setting_key in settings) {
          (settings as any)[item.setting_key] = Number(item.setting_value);
        }
      });

      return settings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const usePricingSettingsRaw = () => {
  return useQuery({
    queryKey: ["pricing-settings-raw"],
    queryFn: async (): Promise<PricingSetting[]> => {
      const { data, error } = await supabase
        .from("pricing_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      return data || [];
    },
  });
};

export const useUpdatePricingSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase
        .from("pricing_settings")
        .update({ setting_value: value })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-settings-raw"] });
    },
  });
};
