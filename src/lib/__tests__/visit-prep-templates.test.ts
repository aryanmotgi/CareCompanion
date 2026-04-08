import { describe, it, expect } from 'vitest'
import { detectVisitType, getVisitTemplate } from '@/lib/visit-prep-templates'

describe('visit-prep-templates', () => {
  describe('detectVisitType', () => {
    it('detects first oncology visit', () => {
      expect(detectVisitType('Cancer consultation', 'Oncology', true)).toBe('first_oncology')
    })

    it('detects scan results', () => {
      expect(detectVisitType('CT scan results review')).toBe('scan_results')
      expect(detectVisitType('MRI result discussion')).toBe('scan_results')
      expect(detectVisitType('PET result follow-up')).toBe('scan_results')
    })

    it('detects infusion day', () => {
      expect(detectVisitType('Chemo infusion cycle 3')).toBe('infusion')
      expect(detectVisitType('Treatment cycle day 1')).toBe('infusion')
    })

    it('detects ER visits', () => {
      expect(detectVisitType('Emergency room visit')).toBe('er_visit')
      expect(detectVisitType('ER for fever')).toBe('er_visit')
    })

    it('detects second opinion', () => {
      expect(detectVisitType('Second opinion consultation')).toBe('second_opinion')
      expect(detectVisitType('2nd opinion visit')).toBe('second_opinion')
    })

    it('detects follow-up with known doctor', () => {
      expect(detectVisitType('Check-up', undefined, false, 'Dr Smith', { hasPriorVisitsWithDoctor: true })).toBe('follow_up')
    })

    it('detects new specialist', () => {
      expect(detectVisitType('Consultation', undefined, true)).toBe('new_specialist')
    })

    it('defaults to general', () => {
      expect(detectVisitType()).toBe('general')
    })
  })

  describe('getVisitTemplate', () => {
    const visitTypes = ['first_oncology', 'follow_up', 'new_specialist', 'er_visit', 'infusion', 'scan_results', 'second_opinion', 'general'] as const

    for (const type of visitTypes) {
      it(`returns valid template for ${type}`, () => {
        const template = getVisitTemplate(type)
        expect(template.type).toBe(type)
        expect(template.label.length).toBeGreaterThan(0)
        expect(template.questions.length).toBeGreaterThan(0)
        expect(template.things_to_bring.length).toBeGreaterThan(0)
        expect(template.prep_tasks.length).toBeGreaterThan(0)
      })
    }

    it('first oncology has more questions than follow-up', () => {
      const first = getVisitTemplate('first_oncology')
      const followUp = getVisitTemplate('follow_up')
      expect(first.questions.length).toBeGreaterThan(followUp.questions.length)
    })

    it('ER template includes medication list in things to bring', () => {
      const template = getVisitTemplate('er_visit')
      expect(template.things_to_bring.some(t => t.toLowerCase().includes('medication'))).toBe(true)
    })
  })
})
