import { permanentRedirect } from 'next/navigation'

export default function BonusesPage() {
  permanentRedirect('/kampanyalar?sekme=bonuslar')
}
