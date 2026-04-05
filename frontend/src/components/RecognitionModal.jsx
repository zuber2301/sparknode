import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HiX, HiOutlineStar, HiOutlineGift, HiOutlineUsers, HiOutlineMailOpen, HiOutlineChevronRight, HiOutlineChevronLeft, HiCheck } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionAPI, usersAPI, engagementAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatPoints } from '../lib/currency'

const ecardTemplates = [
  { id: 'thank_you', name: 'Thank You', color: 'bg-blue-100 text-blue-800', icon: '🙏' },
  { id: 'great_job', name: 'Great Job', color: 'bg-green-100 text-green-800', icon: '👏' },
  { id: 'above_beyond', name: 'Above & Beyond', color: 'bg-purple-100 text-purple-800', icon: '🚀' },
  { id: 'anniversary', name: 'Happy Anniversary', color: 'bg-yellow-100 text-yellow-800', icon: '🎈' },
]

export default function RecognitionModal({ isOpen, onClose, initialSelectedUser = null, defaultType = 'individual_award' }) {
  const [step, setStep] = useState(1) // 1: Select Type, 2: Select Recipients, 3: Message & Points
  const [type, setType] = useState('individual_award')
  const [recipients, setRecipients] = useState([])
  const [message, setMessage] = useState('')
  const [points, setPoints] = useState(10)
  const [badgeId, setBadgeId] = useState('')
  const [ecardTemplate, setEcardTemplate] = useState('thank_you')
  const [isEqualSplit, setIsEqualSplit] = useState(true)
  const [visibility, setVisibility] = useState('public')
  const [searchTerm, setSearchTerm] = useState('')
  const [coreValueTag, setCoreValueTag] = useState('')
  
  const queryClient = useQueryClient()
  const { user, getEffectiveRole, tenantContext } = useAuthStore()

  // Sync incoming props into state each time the modal opens so pre-selected
  // users and pathway types are applied even after a previous close/reset.
  useEffect(() => {
    if (isOpen) {
      const resolvedType = ['individual_award', 'group_award', 'ecard'].includes(defaultType)
        ? defaultType
        : 'individual_award'
      setType(resolvedType)
      setRecipients(initialSelectedUser ? [initialSelectedUser] : [])
      setStep(initialSelectedUser ? 2 : 1)
      setMessage('')
      setPoints(10)
      setBadgeId('')
      setIsEqualSplit(true)
      setEcardTemplate('thank_you')
      setSearchTerm('')
      setCoreValueTag('')
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveRole = getEffectiveRole()
  const isManager = ['tenant_manager', 'dept_lead', 'platform_admin'].includes(effectiveRole)
  const displayCurrency = tenantContext?.display_currency || 'INR'

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll(),
    enabled: isOpen && step === 2
  })

  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: () => recognitionAPI.getBadges().then(r => r.data),
    enabled: isOpen && step === 3
  })

  const { data: companyValues } = useQuery({
    queryKey: ['engagement', 'values'],
    queryFn: () => engagementAPI.getValues().then(r => r.data),
    enabled: isOpen && step === 3,
    staleTime: 5 * 60 * 1000,
  })

  const recognitionMutation = useMutation({
    mutationFn: (data) => recognitionAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['wallet'])
      toast.success('Recognition sent successfully!')
      handleClose()
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to send recognition')
    }
  })

  const handleClose = () => {
    setStep(1)
    setType('individual_award')
    setRecipients([])
    setMessage('')
    setPoints(10)
    setBadgeId('')
    setIsEqualSplit(true)
    setEcardTemplate('thank_you')
    onClose()
  }

  const toggleRecipient = (u) => {
    if (recipients.find(r => r.id === u.id)) {
      setRecipients(recipients.filter(r => r.id !== u.id))
    } else {
      if (type === 'individual_award' || type === 'ecard') {
        setRecipients([u])
      } else {
        setRecipients([...recipients, u])
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (recipients.length === 0) return toast.error('Please select at least one recipient')
    if (!message.trim()) return toast.error('Please enter a message')

    const data = {
      to_user_ids: recipients.map(r => r.id),
      message,
      points: parseFloat(points) || 0,
      badge_id: badgeId || null,
      recognition_type: type,
      ecard_template: type === 'ecard' ? ecardTemplate : null,
      is_equal_split: isEqualSplit,
      visibility,
      core_value_tag: coreValueTag || null
    }

    if (recipients.length === 1) {
      data.to_user_id = recipients[0].id
    }

    recognitionMutation.mutate(data)
  }

  if (!isOpen) return null

  // usersAPI.getAll() returns an Axios response; the actual array is in .data
  const filteredUsers = users?.data?.filter(u => 
    u.id !== user?.id && 
    (u.first_name + ' ' + u.last_name + ' ' + u.corporate_email).toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pointsPerRecipient = type === 'group_award' && isEqualSplit 
    ? (points / recipients.length).toFixed(0)
    : points

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]'>
        <div className='flex items-center justify-between p-4 border-b'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>Recognize Someone</h2>
            <p className='text-sm text-gray-500'>Step {step} of 3</p>
          </div>
          <button onClick={handleClose} className='p-2 hover:bg-gray-100 rounded-full transition'>
            <HiX className='w-6 h-6 text-gray-500' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-6'>
          {step === 1 && (
            <div className='space-y-4'>
              <h3 className='font-semibold text-gray-900'>Choose Award Type</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <button
                  onClick={() => { setType('individual_award'); setStep(2); }}
                  className='flex flex-col items-center p-6 border-2 rounded-xl hover:border-sparknode-purple transition group'
                >
                  <div className='w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition'>
                    <HiOutlineStar className='w-8 h-8' />
                  </div>
                  <span className='font-bold text-gray-900'>Individual Award</span>
                  <span className='text-sm text-gray-500 text-center'>Reward a single person for exceptional contribution</span>
                </button>

                <button
                  onClick={() => { 
                    if (!isManager) return toast.error('Only managers can send group awards');
                    setType('group_award'); setStep(2); 
                  }}
                  className={`flex flex-col items-center p-6 border-2 rounded-xl transition group ${!isManager ? 'opacity-50 cursor-not-allowed' : 'hover:border-sparknode-purple'}`}
                >
                  <div className='w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition'>
                    <HiOutlineUsers className='w-8 h-8' />
                  </div>
                  <span className='font-bold text-gray-900'>Group Award</span>
                  <span className='text-sm text-gray-500 text-center'>Recognize a whole team or squad at once</span>
                </button>

                <button
                  onClick={() => { setType('ecard'); setStep(2); }}
                  className='flex flex-col items-center p-6 border-2 rounded-xl hover:border-sparknode-purple transition group'
                >
                  <div className='w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition'>
                    <HiOutlineMailOpen className='w-8 h-8' />
                  </div>
                  <span className='font-bold text-gray-900'>E-Card</span>
                  <span className='text-sm text-gray-500 text-center'>Send a personalized digital card without points</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-semibold text-gray-900'>
                  {type === 'individual_award' ? 'Select recipient' : 'Select team members'}
                </h3>
                <span className='text-xs text-sparknode-purple font-medium'>{recipients.length} selected</span>
              </div>
              <div className='relative'>
                <input
                  type='text'
                  placeholder='Search by name or email...'
                  className='input w-full pl-10'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <HiOutlineStar className='absolute left-3 top-3 text-gray-400' />
              </div>
              <div className='space-y-2 max-h-60 overflow-y-auto pr-2'>
                {filteredUsers?.map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleRecipient(u)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                      recipients.find(r => r.id === u.id) 
                        ? 'bg-sparknode-purple/10 border-sparknode-purple' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className='flex items-center space-x-3'>
                      <div className='w-8 h-8 bg-sparknode-purple text-white rounded-full flex items-center justify-center text-xs'>
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div className='text-left'>
                        <p className='text-sm font-medium text-gray-900'>{u.first_name} {u.last_name}</p>
                        <p className='text-xs text-gray-500'>{u.corporate_email}</p>
                      </div>
                    </div>
                    {recipients.find(r => r.id === u.id) && (
                      <HiCheck className='w-5 h-5 text-sparknode-purple' />
                    )}
                  </button>
                ))}
              </div>
              <div className='flex justify-between items-center pt-4 border-t mt-4'>
                <button onClick={() => setStep(1)} className='btn-secondary flex items-center space-x-1'>
                  <HiOutlineChevronLeft /> <span>Back</span>
                </button>
                <button 
                  disabled={recipients.length === 0} 
                  onClick={() => setStep(3)} 
                  className='btn-primary flex items-center space-x-1 disabled:opacity-50'
                >
                  <span>Continue</span> <HiOutlineChevronRight />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className='space-y-6'>
              {type === 'ecard' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Select E-Card Design</label>
                  <div className='grid grid-cols-2 gap-3'>
                    {ecardTemplates.map(t => (
                      <button
                        key={t.id}
                        type='button'
                        onClick={() => setEcardTemplate(t.id)}
                        className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition ${
                          ecardTemplate === t.id ? 'border-sparknode-purple bg-sparknode-purple/5' : 'border-gray-100'
                        }`}
                      >
                        <span className='text-2xl'>{t.icon}</span>
                        <span className='text-sm font-medium'>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Your Message</label>
                <textarea
                  required
                  className='input w-full min-h-[100px]'
                  placeholder='Share what makes their contribution special...'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {type !== 'ecard' && (
                <div className='p-4 bg-gray-50 rounded-xl space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='font-bold text-gray-900'>Recognition Points</h4>
                      <p className='text-xs text-gray-500'>How many points to award per person?</p>
                    </div>
                    <div className='flex items-center space-x-2'>
                       <input
                        type='number'
                        min='250'
                        step='50'
                        className='input w-24 text-center font-bold'
                        value={points}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 250;
                          const rounded = Math.max(250, Math.round(val / 50) * 50);
                          setPoints(rounded);
                        }}
                        disabled={!isManager}
                      />
                    </div>
                  </div>
                  
                  {type === 'group_award' && (
                    <div className='flex items-center justify-between py-2 border-t border-gray-200'>
                      <span className='text-sm font-medium text-gray-700'>Split points equally?</span>
                      <button
                        type='button'
                        onClick={() => setIsEqualSplit(!isEqualSplit)}
                        className={`relative w-11 h-6 transition flex rounded-full ${isEqualSplit ? 'bg-sparknode-purple' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${isEqualSplit ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  )}

                  <div className='text-xs text-gray-500 text-right italic'>
                    Total budget to be deducted: <span className='font-bold text-sparknode-purple'>
                      {formatPoints(
                        type === 'group_award' && !isEqualSplit ? points * recipients.length : points,
                        displayCurrency
                      )}
                    </span>
                  </div>
                </div>
              )}

              {type !== 'ecard' && companyValues && companyValues.length > 0 && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Core Value <span className='text-gray-400 font-normal'>(optional)</span></label>
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      onClick={() => setCoreValueTag('')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition ${!coreValueTag ? 'bg-sparknode-purple/10 border-sparknode-purple text-sparknode-purple font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                    >
                      None
                    </button>
                    {companyValues.map(v => (
                      <button
                        key={v.id}
                        type='button'
                        onClick={() => setCoreValueTag(v.name)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition flex items-center gap-1.5 ${coreValueTag === v.name ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium' : 'border-gray-200 hover:border-emerald-300 text-gray-600'}`}
                      >
                        {v.emoji && <span>{v.emoji}</span>}
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Attach a Badge (Optional)</label>
                <div className='flex flex-wrap gap-2'>
                   <button
                    type='button'
                    onClick={() => setBadgeId('')}
                    className={`px-3 py-2 rounded-lg border transition ${
                      !badgeId ? 'bg-sparknode-purple/10 border-sparknode-purple' : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    No Badge
                  </button>
                  {badges?.map(badge => (
                    <button
                      key={badge.id}
                      type='button'
                      onClick={() => setBadgeId(badge.id)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition ${
                        badgeId === badge.id ? 'bg-sparknode-purple/10 border-sparknode-purple' : 'bg-white border-gray-100 hover:border-sparknode-purple'
                      }`}
                    >
                      <span className="text-2xl">{badge.icon_url || badge.icon}</span>
                      <span className='text-sm'>{badge.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
                <div>
                  <p className='font-medium text-gray-900'>Visibility</p>
                  <p className='text-xs text-gray-500'>Public recognitions appear in the company feed</p>
                </div>
                <select 
                  className='input py-1 text-sm bg-transparent'
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value='public'>🌍 Public</option>
                  <option value='private'>🔒 Private</option>
                </select>
              </div>

              <div className='flex justify-between pt-4 border-t'>
                <button type='button' onClick={() => setStep(2)} className='btn-secondary flex items-center space-x-1'>
                  <HiOutlineChevronLeft /> <span>Back</span>
                </button>
                <button
                  type='submit'
                  disabled={recognitionMutation.isPending}
                  className='btn-primary flex items-center space-x-2'
                >
                   {recognitionMutation.isPending ? 'Processing...' : (
                     <>
                      <HiOutlineGift className='w-5 h-5' />
                      <span>Send Recognition</span>
                     </>
                   )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
