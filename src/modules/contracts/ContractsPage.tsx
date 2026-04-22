import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { useContracts } from '@/hooks/useContracts'
import { useAuth } from '@/contexts/AuthContext'
import { ContractStats } from './components/ContractStats'
import { ContractTable } from './components/ContractTable'
import { ContractForm } from './components/ContractForm'
import { ContractDocuments } from './components/ContractDocuments'
import type { Contract, ContractStatus, ContractInsert, ContractUpdate } from '@/types/contracts'

const FILTER_PILLS: { label: string; value: ContractStatus | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Négociation', value: 'negotiation' },
  { label: 'Signé', value: 'signe' },
  { label: 'Actif', value: 'actif' },
  { label: 'Résilié', value: 'resilie' },
]

export default function ContractsPage() {
  const { contracts, isLoading, error, createContract, updateContract, deleteContract } =
    useContracts()
  const { user } = useAuth()

  const [filterStatus, setFilterStatus] = useState<ContractStatus | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [documentsContract, setDocumentsContract] = useState<Contract | null>(null)

  const filteredContracts =
    filterStatus == null
      ? contracts
      : contracts.filter((c) => c.status === filterStatus)

  function handleNewContract() {
    setEditingContract(null)
    setFormOpen(true)
  }

  function handleEdit(contract: Contract) {
    setEditingContract(contract)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingContract(null)
  }

  function handleOpenDocuments(contract: Contract) {
    setDocumentsContract(contract)
  }

  function handleCloseDocuments() {
    setDocumentsContract(null)
  }

  async function handleFormSubmit(data: ContractInsert | ContractUpdate) {
    try {
      if (editingContract) {
        await updateContract(editingContract.id, data as ContractUpdate)
        toast.success('Contrat mis à jour avec succès.')
      } else {
        await createContract(data as ContractInsert)
        toast.success('Contrat créé avec succès.')
      }
      handleFormClose()
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContract(id)
      toast.success('Contrat supprimé.')
    } catch {
      toast.error('Impossible de supprimer le contrat.')
    }
  }

  const canDelete = user?.role === 'admin_full'

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Header */}
      <motion.header variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Contrats B2B
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Gestion des contrats et partenariats MEMOVIA AI.
          </p>
        </div>
        <Button onClick={handleNewContract} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau contrat
        </Button>
      </motion.header>

      {/* Error banner */}
      {error && !isLoading && (
        <motion.div variants={staggerItem} className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </motion.div>
      )}

      {/* KPI Stats */}
      <motion.div variants={staggerItem}>
        <ContractStats contracts={contracts} isLoading={isLoading} error={error} />
      </motion.div>

      {/* Filter pills */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {FILTER_PILLS.map((pill) => {
          const isActive = filterStatus === pill.value
          return (
            <button
              key={pill.label}
              onClick={() => setFilterStatus(pill.value)}
              aria-pressed={isActive}
              aria-label={`Filtrer par statut ${pill.label}`}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-1"
              style={
                isActive
                  ? {
                      backgroundColor: 'var(--memovia-violet)',
                      color: 'white',
                    }
                  : {
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                    }
              }
            >
              {pill.label}
            </button>
          )
        })}
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem}>
        <ContractTable
          contracts={filteredContracts}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDocuments={handleOpenDocuments}
          canDelete={canDelete}
        />
      </motion.div>

      {/* Modal Form */}
      <ContractForm
        open={formOpen}
        onClose={handleFormClose}
        contract={editingContract}
        onSubmit={handleFormSubmit}
      />

      {/* Modal Documents */}
      {documentsContract && (
        <ContractDocuments
          open={documentsContract != null}
          onClose={handleCloseDocuments}
          contractId={documentsContract.id}
          contractName={documentsContract.organization_name}
          canDelete={canDelete}
        />
      )}
    </motion.div>
  )
}
