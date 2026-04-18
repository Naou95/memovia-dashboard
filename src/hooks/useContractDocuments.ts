import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ContractDocument {
  id: string
  contract_id: string
  file_name: string
  file_path: string
  file_size: number
  uploaded_by: string | null
  created_at: string
}

export interface UseContractDocumentsResult {
  documents: ContractDocument[]
  isLoading: boolean
  error: string | null
  uploadDocument: (file: File) => Promise<void>
  downloadDocument: (doc: ContractDocument) => Promise<void>
  deleteDocument: (doc: ContractDocument) => Promise<void>
}

export function useContractDocuments(contractId: string): UseContractDocumentsResult {
  const [documents, setDocuments] = useState<ContractDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    const { data, error: sbError } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (sbError || !data) {
      setError('Impossible de charger les documents')
      setIsLoading(false)
      return
    }

    setDocuments(data as ContractDocument[])
    setError(null)
    setIsLoading(false)
  }, [contractId])

  useEffect(() => {
    if (contractId) fetchDocuments()
  }, [fetchDocuments, contractId])

  const uploadDocument = async (file: File): Promise<void> => {
    // Path unique : {contractId}/{timestamp}_{fileName}
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')
    const path = `${contractId}/${Date.now()}_${safeName}`

    const { error: storageError } = await supabase.storage
      .from('contract-documents')
      .upload(path, file)

    if (storageError) throw storageError

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('contract_documents').insert({
      contract_id: contractId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
    })

    if (insertError) {
      // Rollback storage object on table insert failure
      await supabase.storage.from('contract-documents').remove([path])
      throw insertError
    }

    await fetchDocuments()
  }

  const downloadDocument = async (doc: ContractDocument): Promise<void> => {
    const { data, error: signedError } = await supabase.storage
      .from('contract-documents')
      .createSignedUrl(doc.file_path, 3600) // 1 heure

    if (signedError || !data) throw signedError ?? new Error('Signed URL failed')

    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = doc.file_name
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }

  const deleteDocument = async (doc: ContractDocument): Promise<void> => {
    // Supprimer du storage d'abord
    const { error: storageError } = await supabase.storage
      .from('contract-documents')
      .remove([doc.file_path])

    if (storageError) throw storageError

    const { error: tableError } = await supabase
      .from('contract_documents')
      .delete()
      .eq('id', doc.id)

    if (tableError) throw tableError

    await fetchDocuments()
  }

  return { documents, isLoading, error, uploadDocument, downloadDocument, deleteDocument }
}
