import { createContext, useContext, useState, useEffect } from "react"

// Language types
export type Language = "en" | "fr"

// Translation interface
interface Translations {
  [key: string]: string | Translations
}

// Language context interface
interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

// Create context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translation storage
const translations: Record<Language, Translations> = {
  en: {
    // Navigation
    "nav.findParking": "Find Parking",
    "nav.myBookings": "My Bookings", 
    "nav.dashboard": "Dashboard",
    "nav.statistics": "Statistics",
    "nav.mySpots": "My Spots",
    "nav.userManagement": "User Management",
    "nav.spotManagement": "Spot Management",
    "nav.reports": "Reports",
    "nav.systemSettings": "System Settings",
    "nav.profile": "Profile",
    "nav.notifications": "Notifications",

    // Profile page
    "profile.title": "Profile & Settings",
    "profile.tabs.notifications": "Notifications",
    "profile.tabs.waitingList": "Waiting List",
    "profile.tabs.vehicles": "Vehicles", 
    "profile.tabs.appSettings": "App Settings",
    
    // App Settings
    "appSettings.language": "Language",
    "appSettings.language.description": "Choose your preferred language",
    "appSettings.theme": "Theme",
    "appSettings.theme.description": "Choose your preferred theme",
    "appSettings.theme.light": "Light",
    "appSettings.theme.dark": "Dark",
    "appSettings.theme.system": "System",
    "appSettings.language.english": "English",
    "appSettings.language.french": "French",

    // Notifications
    "notifications.title": "Notification Preferences",
    "notifications.emailNotifications": "Email Notifications",
    "notifications.emailNotifications.description": "Receive notifications via email",
    "notifications.bookingConfirmations": "Booking Confirmations",
    "notifications.bookingConfirmations.description": "Get notified when bookings are confirmed",
    "notifications.paymentReminders": "Payment Reminders", 
    "notifications.paymentReminders.description": "Receive reminders for pending payments",
    "notifications.spotAvailability": "Spot Availability",
    "notifications.spotAvailability.description": "Get alerts when preferred spots become available",
    "notifications.weeklyReports": "Weekly Reports",
    "notifications.weeklyReports.description": "Receive weekly summary reports",
    "notifications.systemMaintenance": "System Maintenance",
    "notifications.systemMaintenance.description": "Get notified about system maintenance",

    // Waiting List
    "waitingList.title": "Parking Waiting List",
    "waitingList.description": "Join the waiting list to be notified when parking spots become available.",
    "waitingList.enrollButton": "Join Waiting List",
    "waitingList.enrolled": "You're on the list!",
    "waitingList.spotType": "Spot Type",
    "waitingList.building": "Building", 
    "waitingList.priority": "Priority",
    "waitingList.edit": "Edit",
    "waitingList.leave": "Leave",
    "waitingList.form.preferredSpotType": "Preferred Spot Type",
    "waitingList.form.preferredBuilding": "Preferred Building", 
    "waitingList.form.priority": "Priority Level",
    "waitingList.form.reason": "Reason",
    "waitingList.form.save": "Save Changes",
    "waitingList.form.cancel": "Cancel",

    // Vehicles
    "vehicles.title": "My Vehicles",
    "vehicles.addVehicle": "Add Vehicle",
    "vehicles.editVehicle": "Edit Vehicle",
    "vehicles.noVehicles": "No vehicles added yet",
    "vehicles.addFirst": "Add your first vehicle to complete your profile.",
    "vehicles.make": "Make",
    "vehicles.model": "Model",
    "vehicles.year": "Year",
    "vehicles.licensePlate": "License Plate",
    "vehicles.color": "Color",
    "vehicles.isElectric": "Electric Vehicle",
    "vehicles.isDefault": "Primary Vehicle",
    "vehicles.save": "Save Vehicle",
    "vehicles.cancel": "Cancel",
    "vehicles.edit": "Edit",
    "vehicles.delete": "Delete",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.loading": "Loading...",
    "common.success": "Success",
    "common.error": "Error",
  },
  fr: {
    // Navigation
    "nav.findParking": "Trouver un Parking",
    "nav.myBookings": "Mes Réservations",
    "nav.dashboard": "Tableau de Bord",
    "nav.statistics": "Statistiques", 
    "nav.mySpots": "Mes Places",
    "nav.userManagement": "Gestion des Utilisateurs",
    "nav.spotManagement": "Gestion des Places",
    "nav.reports": "Rapports",
    "nav.systemSettings": "Paramètres Système",
    "nav.profile": "Profil",
    "nav.notifications": "Notifications",

    // Profile page
    "profile.title": "Profil et Paramètres",
    "profile.tabs.notifications": "Notifications",
    "profile.tabs.waitingList": "Liste d'Attente",
    "profile.tabs.vehicles": "Véhicules",
    "profile.tabs.appSettings": "Paramètres de l'Application",
    
    // App Settings
    "appSettings.language": "Langue",
    "appSettings.language.description": "Choisissez votre langue préférée",
    "appSettings.theme": "Thème",
    "appSettings.theme.description": "Choisissez votre thème préféré",
    "appSettings.theme.light": "Clair",
    "appSettings.theme.dark": "Sombre",
    "appSettings.theme.system": "Système",
    "appSettings.language.english": "Anglais",
    "appSettings.language.french": "Français",

    // Notifications
    "notifications.title": "Préférences de Notification",
    "notifications.emailNotifications": "Notifications par Email",
    "notifications.emailNotifications.description": "Recevoir des notifications par email",
    "notifications.bookingConfirmations": "Confirmations de Réservation",
    "notifications.bookingConfirmations.description": "Être notifié lorsque les réservations sont confirmées",
    "notifications.paymentReminders": "Rappels de Paiement",
    "notifications.paymentReminders.description": "Recevoir des rappels pour les paiements en attente",
    "notifications.spotAvailability": "Disponibilité des Places",
    "notifications.spotAvailability.description": "Recevoir des alertes lorsque les places préférées deviennent disponibles",
    "notifications.weeklyReports": "Rapports Hebdomadaires",
    "notifications.weeklyReports.description": "Recevoir des rapports de synthèse hebdomadaires",
    "notifications.systemMaintenance": "Maintenance du Système",
    "notifications.systemMaintenance.description": "Être notifié de la maintenance du système",

    // Waiting List
    "waitingList.title": "Liste d'Attente de Parking",
    "waitingList.description": "Rejoignez la liste d'attente pour être notifié lorsque des places de parking se libèrent.",
    "waitingList.enrollButton": "Rejoindre la Liste d'Attente",
    "waitingList.enrolled": "Vous êtes sur la liste !",
    "waitingList.spotType": "Type de Place",
    "waitingList.building": "Bâtiment",
    "waitingList.priority": "Priorité",
    "waitingList.edit": "Modifier",
    "waitingList.leave": "Quitter",
    "waitingList.form.preferredSpotType": "Type de Place Préféré",
    "waitingList.form.preferredBuilding": "Bâtiment Préféré",
    "waitingList.form.priority": "Niveau de Priorité",
    "waitingList.form.reason": "Raison",
    "waitingList.form.save": "Enregistrer les Modifications",
    "waitingList.form.cancel": "Annuler",

    // Vehicles
    "vehicles.title": "Mes Véhicules",
    "vehicles.addVehicle": "Ajouter un Véhicule",
    "vehicles.editVehicle": "Modifier le Véhicule",
    "vehicles.noVehicles": "Aucun véhicule ajouté",
    "vehicles.addFirst": "Ajoutez votre premier véhicule pour compléter votre profil.",
    "vehicles.make": "Marque",
    "vehicles.model": "Modèle",
    "vehicles.year": "Année",
    "vehicles.licensePlate": "Plaque d'Immatriculation",
    "vehicles.color": "Couleur",
    "vehicles.isElectric": "Véhicule Électrique",
    "vehicles.isDefault": "Véhicule Principal",
    "vehicles.save": "Enregistrer le Véhicule",
    "vehicles.cancel": "Annuler",
    "vehicles.edit": "Modifier",
    "vehicles.delete": "Supprimer",

    // Common
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.edit": "Modifier",
    "common.delete": "Supprimer",
    "common.loading": "Chargement...",
    "common.success": "Succès",
    "common.error": "Erreur",
  }
}

// Helper function to get nested translation
function getNestedTranslation(obj: Translations, path: string): string {
  const keys = path.split('.')
  let current: any = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return path // Return the key if translation not found
    }
  }
  
  return typeof current === 'string' ? current : path
}

// Language provider component
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get language from localStorage or default to English
    const saved = localStorage.getItem('bci-parking-language')
    return (saved === 'en' || saved === 'fr') ? saved : 'en'
  })

  // Translation function with parameter support
  const t = (key: string, params?: Record<string, string>): string => {
    let translation = getNestedTranslation(translations[language], key)
    
    // Replace parameters in the translation
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{{${param}}}`, value)
      })
    }
    
    return translation
  }

  // Set language function that also saves to localStorage
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem('bci-parking-language', newLanguage)
  }

  // Update document language attribute
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value: LanguageContextType = {
    language,
    setLanguage,
    t
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

// Custom hook to use language context
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}