import api from '@/utils/api'

export interface IStatus {
  is_bridge: boolean
  is_tweet: boolean
  is_claim: boolean
  is_claim_success: boolean
  txHash?: string
}

export const getActivityStatus = async (address: string): Promise<IStatus> => {
	const res = await api.get(`/api/gift/status/${address}`)
	return res.data as IStatus
}

export const claimActivity = async (address: string) => {
	return await api.get(`/api/gift/claim/${address}`)
}