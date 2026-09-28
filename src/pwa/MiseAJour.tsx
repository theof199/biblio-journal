import { useRegisterSW } from 'virtual:pwa-register/react'
import BandeauMiseAJour from './BandeauMiseAJour'

export default function MiseAJour() {
  const {
    needRefresh: [versionEnAttente],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <BandeauMiseAJour visible={versionEnAttente} onRecharger={() => void updateServiceWorker(true)} />
  )
}
