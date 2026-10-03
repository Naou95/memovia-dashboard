// Clés Supabase de nouvelle génération (sb_secret_… / sb_publishable_…), injectées par la plateforme en JSON
// par nom. Aucun repli sur SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY : elles cessent de marcher fin 2026
// et la service_role a fuité le 29/09/2026. Clé absente = la fonction échoue (fermé), jamais une clé vide.
const cle = (variable: string): string => {
  const valeur = (JSON.parse(Deno.env.get(variable) || '{}') as Record<string, string>)['default']
  if (!valeur) throw new Error(`${variable}["default"] absente`)
  return valeur
}

export const secretKey = () => cle('SUPABASE_SECRET_KEYS')
export const publishableKey = () => cle('SUPABASE_PUBLISHABLE_KEYS')
