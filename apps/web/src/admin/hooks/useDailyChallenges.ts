import { useCallback, useEffect, useState } from "react";
import type { ChallengeType } from "@app/shared-types";
import { supabase } from "../../lib/supabaseClient";

export interface ChallengePackage {
  clubId: string;
  era: string;
}

export interface DailyChallenge {
  id: string;
  challengeDate: string;
  challengeType: ChallengeType;
  packages: ChallengePackage[];
}

interface DailyChallengeRow {
  id: string;
  challenge_date: string;
  challenge_type: ChallengeType;
  seed: { packages: ChallengePackage[] };
}

function fromRow(row: DailyChallengeRow): DailyChallenge {
  return {
    id: row.id,
    challengeDate: row.challenge_date,
    challengeType: row.challenge_type,
    packages: row.seed?.packages ?? [],
  };
}

export function useDailyChallenges() {
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_challenges")
      .select("*")
      .order("challenge_date", { ascending: false })
      .returns<DailyChallengeRow[]>();
    setChallenges((data ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createChallenge(input: {
    challengeDate: string;
    challengeType: ChallengeType;
    packages: ChallengePackage[];
  }) {
    const { error } = await supabase.from("daily_challenges").insert({
      challenge_date: input.challengeDate,
      challenge_type: input.challengeType,
      seed: { packages: input.packages },
    });
    if (error) throw error;
    await refetch();
  }

  return { challenges, loading, createChallenge };
}
