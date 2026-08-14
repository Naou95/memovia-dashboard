import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Authentifie un appel venant de pg_cron via le header `x-cron-secret`.
 *
 * Pourquoi ce module existe : les crons du dashboard s'authentifiaient par
 * `current_setting('app.service_role_key')`, un GUC que personne n'a jamais posé — les
 * migrations 00016, 00019 et 00029 le documentent en commentaire depuis avril, et il est
 * resté NULL. Résultat mesuré le 14/08/2026 dans `cron.job_run_details` :
 * `telegram-daily-briefing` 117 échecs d'affilée depuis le 20/04, `email-lead-detector-daily`
 * 113 depuis le 23/04. Aucun des deux n'a jamais tourné une seule fois.
 *
 * Et poser ce GUC n'aurait rien réparé : l'entrée Vault **nommée** `service_role_key` contient
 * en réalité la clé **anon**. `telegram-daily-briefing` compare le token à
 * SUPABASE_SERVICE_ROLE_KEY (401), et `email-lead-detector` valide via `auth.getUser()`, qui
 * attend un JWT **utilisateur** : aucune clé de service ne franchit cette porte, par construction.
 *
 * D'où un secret dédié plutôt que la clé service_role : celle-ci bypasse toute la RLS, et la
 * poser dans un GUC de base la rendrait lisible par `current_setting` depuis n'importe quelle
 * session. Le secret ci-dessous est généré dans Postgres, stocké chiffré dans Vault, et son
 * seul pouvoir est de déclencher ces crons. Il est comparé côté base par
 * `public.verify_cron_secret` (SECURITY DEFINER) : la fonction edge ne reçoit qu'un booléen,
 * le secret ne sort jamais de la base. Migration : 00034.
 */
export async function isAuthenticatedCronCall(req: Request): Promise<boolean> {
  const secret = req.headers.get('x-cron-secret')
  if (!secret) return false

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data, error } = await supabaseAdmin.rpc('verify_cron_secret', { p_secret: secret })

    if (error) {
      console.error('[cronAuth] verify_cron_secret a échoué:', error.message)
      return false
    }
    // Strictement `true` : un null (secret absent de Vault) ne doit jamais ouvrir la porte.
    return data === true
  } catch (e) {
    console.error('[cronAuth] erreur inattendue:', e instanceof Error ? e.message : e)
    return false
  }
}
