import React, { createContext, useContext, useState } from "react";

export type OnboardingData = {
  goal: string;
  level: string;
  current_time: string | null;
  target_time: string | null;
  race_date: string | null;
  frequency: number;
};

const defaultData: OnboardingData = {
  goal: "semi",
  level: "intermediaire",
  current_time: null,
  target_time: null,
  race_date: null,
  frequency: 4,
};

type Ctx = {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
};

const OnboardingContext = createContext<Ctx>({} as Ctx);

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);
  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }));
  return (
    <OnboardingContext.Provider value={{ data, update }}>
      {children}
    </OnboardingContext.Provider>
  );
}
