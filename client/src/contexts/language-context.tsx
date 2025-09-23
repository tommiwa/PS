import { createContext, useState, useEffect, useMemo, useCallback } from "react"

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

// Create context - exported for use in separate hook file
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Export the type for the hook
export type { LanguageContextType }

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
    "waitingList.editPreferences": "Edit Waiting List Preferences",
    "waitingList.joinTitle": "Join the Waiting List",
    "waitingList.joinDescription": "Get notified when spots become available.",
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

    // Tooltips
    "tooltip.tabs.notifications": "Manage your email and push notification preferences",
    "tooltip.tabs.waitingList": "Join the waiting list to be notified when parking spots become available",
    "tooltip.tabs.vehicles": "Add and manage your vehicles for parking spot bookings",
    "tooltip.tabs.appSettings": "Configure privacy, security, and application display settings",
    
    "tooltip.notifications.emailToggle": "Toggle all email notifications on or off - disabling stops all emails from the system",
    "tooltip.notifications.bookingConfirmations": "Receive email confirmations when you successfully book or cancel a parking spot",
    "tooltip.notifications.paymentReminders": "Get reminded about upcoming payment deadlines and overdue balances",
    "tooltip.notifications.spotAvailability": "Be notified when preferred parking spots become available from the waiting list",
    "tooltip.notifications.weeklyReports": "Receive weekly summaries of your parking activity, savings, and system updates",
    "tooltip.notifications.systemMaintenance": "Get notified about scheduled system maintenance that may affect parking availability",
    
    "tooltip.waitingList.enroll": "Join the waiting list to receive notifications when parking spots matching your preferences become available",
    "tooltip.waitingList.reason": "Optional brief explanation for your parking need - helps administrators prioritize requests",
    "tooltip.waitingList.cancel": "Cancel changes and return to viewing your current waiting list preferences",
    "tooltip.waitingList.save": "Save your updated waiting list preferences - this may change your position in the queue",
    "tooltip.waitingList.priority": "Higher priority levels are reserved for accessibility needs, medical requirements, and pregnancy",
    "tooltip.waitingList.spotType": "Choose the type of parking spot that matches your vehicle and needs",
    "tooltip.waitingList.building": "Select your preferred building location - closer buildings may have longer wait times",
    
    "tooltip.vehicles.add": "Add a new vehicle to your profile for parking spot bookings",
    "tooltip.vehicles.edit": "Modify vehicle information - changes will apply to future bookings",
    "tooltip.vehicles.delete": "Permanently remove this vehicle from your profile - this action cannot be undone",
    "tooltip.vehicles.make": "Enter the manufacturer of your vehicle (e.g., Toyota, Ford, BMW)",
    "tooltip.vehicles.model": "Enter the specific model of your vehicle",
    "tooltip.vehicles.year": "Enter the year your vehicle was manufactured",
    "tooltip.vehicles.licensePlate": "Enter your vehicle's license plate number exactly as it appears",
    "tooltip.vehicles.color": "Vehicle color helps with identification in parking areas",
    "tooltip.vehicles.isElectric": "Mark if this is an electric vehicle to access electric charging spots",
    "tooltip.vehicles.isDefault": "Set as your primary vehicle for faster booking",
    
    "tooltip.profile.editCancel": "Discard changes and close profile editing without saving",
    "tooltip.profile.editSave": "Save your profile changes - updated information will be visible to other users based on privacy settings",
    "tooltip.profile.deleteAccount": "Permanently delete your account and all associated data - this action cannot be undone and will remove all bookings, vehicles, and preferences",
    "tooltip.profile.exportData": "Download a copy of all your personal data stored in the system",
    "tooltip.profile.changePassword": "Update your account password for enhanced security",
    "tooltip.profile.fullName": "Your full name as it appears on official documents",
    "tooltip.profile.email": "Email address is managed by IT and cannot be changed here",
    "tooltip.profile.phone": "Your contact phone number for parking coordination and notifications",
    "tooltip.profile.department": "Your department information is managed by HR and cannot be changed here",
    "tooltip.profile.bio": "Optional brief description visible to other users based on privacy settings",
    "tooltip.profile.changePhoto": "Upload a new profile photo (JPG, PNG or GIF, max 2MB)",
    
    "tooltip.security.twoFactor": "Enable two-factor authentication for enhanced account security",
    "tooltip.security.loginAlerts": "Receive notifications when someone logs into your account from a new device",
    "tooltip.security.profileVisibility": "Control what information other users can see in your profile",
    "tooltip.security.dataSharing": "Manage how your data is used for system improvements and analytics",
    
    "tooltip.settings.language": "Choose your preferred language for the interface - changes take effect immediately",
    "tooltip.settings.theme": "Select your preferred theme appearance - dark, light, or follow your system setting",

    // Info Popovers - Critical Information
    "info.security.deleteAccount.title": "Account Deletion Warning",
    "info.security.deleteAccount.content": "This action permanently deletes your account and ALL associated data including bookings, vehicles, waiting list entries, and preferences. This cannot be undone. All future and past booking history will be lost.",
    "info.security.twoFactor.title": "Two-Factor Authentication",
    "info.security.twoFactor.content": "Adds an extra security layer requiring both password and phone/app verification. Recommended for accounts with payment methods or sensitive parking data access.",
    "info.security.profileVisibility.title": "Profile Privacy Settings",
    "info.security.profileVisibility.content": "Private: Only you see your information. BCI Employees: Colleagues can view your parking preferences and contact details for coordination.",
    "info.security.contactSharing.title": "Contact Information Sharing",
    "info.security.contactSharing.content": "Allows spot owners/renters to contact you directly for parking coordination. Disabling may limit booking opportunities but improves privacy.",
    "info.security.changePassword.title": "Change Password",
    "info.security.changePassword.content": "You will be logged out of all devices after changing your password. Make sure to use a strong, unique password.",
    "info.security.exportData.title": "Export Personal Data",
    "info.security.exportData.content": "This will generate a complete backup of your profile, bookings, vehicles, and preferences in JSON format for download.",
    
    "info.waitingList.priority.title": "Priority Level Guidelines",
    "info.waitingList.priority.content": "High Priority: Reserved for accessibility needs, medical conditions, pregnancy, or urgent circumstances. Medium Priority: Regular commuters with consistent needs. Low Priority: Occasional or flexible parking requirements.",
    "info.waitingList.consequences.title": "Important: Position Changes",
    "info.waitingList.consequences.content": "Updating your preferences may change your position in the waiting list. Priority increases move you up, while lowering priority or changing spot type may move you down. Changes are effective immediately.",
    
    "info.vehicles.delete.title": "Remove Vehicle Warning",
    "info.vehicles.delete.content": "This permanently removes the vehicle from your profile. Any active bookings with this vehicle will remain valid, but you cannot make new bookings until you add another vehicle.",

    // Profile UI Text
    "profile.profile": "Profile",
    "profile.loginPrompt": "Please log in to view your profile.",
    "profile.fullName": "Full Name",
    "profile.emailAddress": "Email Address",
    "profile.phoneNumber": "Phone Number",
    "profile.department": "Department",
    "profile.bio": "Bio (Optional)",
    "profile.bioPlaceholder": "Tell others about yourself...",
    "profile.photoFormat": "JPG, PNG or GIF. Max size 2MB.",
    "profile.user": "User",
    "profile.loadingPreferences": "Loading preferences...",
    "profile.emailNotificationTypes": "Email Notification Types",
    "profile.managedByIT": "Email address is managed by IT and cannot be changed here.",
    "profile.managedByHR": "Your department information is managed by HR and cannot be changed here.",
    "profile.saveChanges": "Save Changes",
    "profile.changePassword": "Change Password",
    "profile.exportData": "Export Data",
    "profile.deleteAccount": "Delete Account",
    "profile.changePhoto": "Change Photo",
    "profile.settings": "Manage your account settings and privacy preferences",
    "profile.editProfile": "Edit Profile",

    // Profile Specific  
    "profile.assignedSpots": "My Assigned Parking Spots",
    "profile.spotsOwned": "{count} parking spot{count !== '1' ? 's' : ''} owned",
    "profile.spotNumber": "Spot {number}",
    "profile.noSpotsAssigned": "No parking spots assigned",
    "profile.contactAdmin": "Contact your administrator to assign parking spots to your account",
    "profile.memberSince": "Member since {date}",
    "profile.privacy": "Privacy & Security",
    "profile.profileVisibility": "Profile Visibility",
    "profile.profileVisibilityDesc": "Who can see your profile information",
    "profile.contactSharing": "Contact Information Sharing",
    "profile.contactSharingDesc": "Share your contact info with spot owners/renters",
    "profile.bookingHistory": "Booking History Visibility",
    "profile.bookingHistoryDesc": "Allow others to see your booking statistics",
    "profile.securitySettings": "Security Settings",
    "profile.twoFactor": "Two-Factor Authentication",
    "profile.twoFactorDesc": "Add an extra layer of security to your account",
    "profile.recentActivity": "Recent Login Activity",
    "profile.lastLogin": "Last login: {date} at {time} (Current session)",
    "profile.previousLogin": "Previous login: {date} at {time}",
    "profile.enableTwoFactor": "Enable Two-Factor Authentication",
    "profile.notEnabled": "Not Enabled",
    "profile.bciEmployeesOnly": "BCI Employees Only",
    "profile.private": "Private",
    "profile.accountActions": "Account Actions",
    "profile.changePasswordDesc": "Update your account password for enhanced security",
    "profile.exportDataDesc": "Download a copy of all your personal data stored in the system",
    "profile.deleteAccountDesc": "Permanently delete your account and all associated data",

    // Form Placeholders
    "placeholder.selectSpotType": "Select spot type",
    "placeholder.selectBuilding": "Select building",
    "placeholder.selectPriority": "Select priority",
    "placeholder.briefReason": "Brief reason for parking need...",

    // Priority Levels
    "priority.high.label": "High Priority",
    "priority.high.description": "Urgent need due to accessibility, pregnancy, or medical reasons",
    "priority.medium.label": "Medium Priority",
    "priority.medium.description": "Regular commuter with consistent parking needs",
    "priority.low.label": "Low Priority",
    "priority.low.description": "Occasional use or flexible parking requirements",

    // Building Options
    "building.a": "Building A - Main Campus",
    "building.b": "Building B - East Wing",
    "building.c": "Building C - West Wing",
    "building.d": "Building D - Annex",

    // Validation Messages
    "validation.spotTypeRequired": "Please select a preferred spot type",
    "validation.buildingRequired": "Please select a preferred building",
    "validation.priorityRequired": "Please select a priority level",
    "validation.reasonMinLength": "Please provide a reason (at least 10 characters)",
    "validation.makeRequired": "Vehicle make is required",
    "validation.modelRequired": "Vehicle model is required",
    "validation.yearMin": "Year must be 1990 or later",
    "validation.yearMax": "Year cannot be in the future",
    "validation.licensePlateRequired": "License plate is required",

    // Toast Messages
    "toast.enrollSuccess.title": "Successfully Enrolled!",
    "toast.enrollSuccess.description": "You've been added to the waiting list. You'll be notified when a spot becomes available.",
    "toast.enrollFailed.title": "Enrollment Failed",
    "toast.enrollFailed.description": "Failed to join waiting list. Please try again.",
    "toast.preferencesUpdated.title": "Preferences Updated",
    "toast.preferencesUpdated.description": "Your waiting list preferences have been successfully updated.",
    "toast.updateFailed.title": "Update Failed",
    "toast.updateFailed.description": "Failed to update preferences. Please try again.",
    "toast.removedFromList.title": "Removed from Waiting List",
    "toast.removedFromList.description": "You've been successfully removed from the waiting list.",
    "toast.cancellationFailed.title": "Cancellation Failed",
    "toast.cancellationFailed.description": "Failed to remove from waiting list. Please try again.",
    "toast.vehicleAdded.title": "Vehicle Added",
    "toast.vehicleAdded.description": "Your vehicle has been successfully added.",
    "toast.vehicleAddFailed.title": "Failed to Add Vehicle",
    "toast.vehicleAddFailed.description": "Please try again.",
    "toast.vehicleUpdated.title": "Vehicle Updated",
    "toast.vehicleUpdated.description": "Your vehicle has been successfully updated.",
    "toast.vehicleUpdateFailed.title": "Failed to Update Vehicle",
    "toast.vehicleUpdateFailed.description": "Please try again.",
    "toast.vehicleDeleted.title": "Vehicle Deleted",
    "toast.vehicleDeleted.description": "Your vehicle has been successfully removed.",
    "toast.vehicleDeleteFailed.title": "Failed to Delete Vehicle",
    "toast.vehicleDeleteFailed.description": "Please try again.",
    "toast.notificationUpdateFailed.title": "Failed to Update Preferences",
    "toast.notificationUpdateFailed.description": "Your notification preferences could not be saved. Please try again.",
    "toast.leftWaitingList.title": "Left Waiting List",
    "toast.leftWaitingList.description": "You've been removed from the waiting list. You can re-enroll anytime.",
    "toast.enrolledWaitingList.title": "Enrolled in Waiting List!",
    "toast.enrolledWaitingList.description": "You'll receive notifications when spots become available that match your preferences.",
    "toast.alertsDisabled.title": "Availability Alerts Disabled",
    "toast.alertsDisabled.description": "You won't receive push notifications about available spots. You can re-enable this anytime.",
    "toast.alertsEnabled.title": "Availability Alerts Enabled!",
    "toast.alertsEnabled.description": "You'll get instant notifications when your preferred spots become available. Never miss out!",
    "toast.reportsAvailable.title": "Reports Available",
    "toast.reportsAvailable.description": "View your booking history and parking analytics.",

    // Info tooltips for icons
    "tooltip.info.profileVisibility": "Click for more information about profile visibility settings",
    "tooltip.info.contactSharing": "Click for more information about contact information sharing",
    "tooltip.info.twoFactor": "Click for more information about two-factor authentication",
    "tooltip.info.priority": "Click for more information about priority level guidelines",

    // Roles
    "role.admin": "Administrator",
    "role.owner": "Spot Owner",
    "role.renter": "Renter",

    // Spot Types
    "spotType.regular": "Regular",
    "spotType.electric": "Electric",
    "spotType.accessible": "Accessible",
    "spotType.teslaEv": "Tesla EV",
    "spotType.reserved": "Reserved",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.loading": "Loading...",
    "common.success": "Success",
    "common.error": "Error",
    "common.saving": "Saving...",
    "common.tryAgain": "Please try again.",
    "common.recently": "Recently",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.indoor": "Indoor",
    "common.availableForSharing": "Available for Sharing",
    "common.canBeShared": "Can be shared",
    "common.optional": "Optional",
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
    "waitingList.editPreferences": "Modifier les Préférences de Liste d'Attente",
    "waitingList.joinTitle": "Rejoindre la Liste d'Attente",
    "waitingList.joinDescription": "Soyez notifié lorsque des places deviennent disponibles.",
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

    // Tooltips
    "tooltip.tabs.notifications": "Gérez vos préférences de notifications par email et push",
    "tooltip.tabs.waitingList": "Rejoignez la liste d'attente pour être notifié des places de parking disponibles",
    "tooltip.tabs.vehicles": "Ajoutez et gérez vos véhicules pour les réservations de places",
    "tooltip.tabs.appSettings": "Configurez la confidentialité, la sécurité et les paramètres d'affichage",
    
    "tooltip.notifications.emailToggle": "Activez ou désactivez toutes les notifications par email - la désactivation arrête tous les emails du système",
    "tooltip.notifications.bookingConfirmations": "Recevez des confirmations par email lors de la réservation ou l'annulation d'une place",
    "tooltip.notifications.paymentReminders": "Recevez des rappels pour les échéances de paiement et les soldes en retard",
    "tooltip.notifications.spotAvailability": "Soyez notifié lorsque des places de parking préférées deviennent disponibles depuis la liste d'attente",
    "tooltip.notifications.weeklyReports": "Recevez des résumés hebdomadaires de votre activité de parking, économies et mises à jour système",
    "tooltip.notifications.systemMaintenance": "Soyez notifié de la maintenance système programmée qui peut affecter la disponibilité du parking",
    
    "tooltip.waitingList.enroll": "Rejoignez la liste d'attente pour recevoir des notifications lorsque des places correspondant à vos préférences deviennent disponibles",
    "tooltip.waitingList.reason": "Explication optionnelle de votre besoin de parking - aide les administrateurs à prioriser les demandes",
    "tooltip.waitingList.cancel": "Annulez les modifications et revenez à la visualisation de vos préférences actuelles de liste d'attente",
    "tooltip.waitingList.save": "Enregistrez vos préférences de liste d'attente mises à jour - cela peut changer votre position dans la file",
    "tooltip.waitingList.priority": "Les niveaux de priorité élevés sont réservés aux besoins d'accessibilité, exigences médicales et grossesse",
    "tooltip.waitingList.spotType": "Choisissez le type de place de parking qui correspond à votre véhicule et vos besoins",
    "tooltip.waitingList.building": "Sélectionnez votre emplacement de bâtiment préféré - les bâtiments plus proches peuvent avoir des temps d'attente plus longs",
    
    "tooltip.vehicles.add": "Ajoutez un nouveau véhicule à votre profil pour les réservations de places",
    "tooltip.vehicles.edit": "Modifiez les informations du véhicule - les changements s'appliqueront aux futures réservations",
    "tooltip.vehicles.delete": "Supprimez définitivement ce véhicule de votre profil - cette action ne peut pas être annulée",
    "tooltip.vehicles.make": "Entrez le fabricant de votre véhicule (ex: Toyota, Ford, BMW)",
    "tooltip.vehicles.model": "Entrez le modèle spécifique de votre véhicule",
    "tooltip.vehicles.year": "Entrez l'année de fabrication de votre véhicule",
    "tooltip.vehicles.licensePlate": "Entrez le numéro de plaque d'immatriculation de votre véhicule exactement comme il apparaît",
    "tooltip.vehicles.color": "La couleur du véhicule aide à l'identification dans les zones de parking",
    "tooltip.vehicles.isElectric": "Marquez si c'est un véhicule électrique pour accéder aux places de recharge électrique",
    "tooltip.vehicles.isDefault": "Définissez comme votre véhicule principal pour une réservation plus rapide",
    
    "tooltip.profile.editCancel": "Annulez les modifications et fermez l'édition du profil sans enregistrer",
    "tooltip.profile.editSave": "Enregistrez vos modifications de profil - les informations mises à jour seront visibles par les autres utilisateurs selon les paramètres de confidentialité",
    "tooltip.profile.deleteAccount": "Supprimez définitivement votre compte et toutes les données associées - cette action ne peut pas être annulée et supprimera toutes les réservations, véhicules et préférences",
    "tooltip.profile.exportData": "Téléchargez une copie de toutes vos données personnelles stockées dans le système",
    "tooltip.profile.changePassword": "Mettez à jour le mot de passe de votre compte pour une sécurité renforcée",
    "tooltip.profile.fullName": "Votre nom complet tel qu'il apparaît sur les documents officiels",
    "tooltip.profile.email": "L'adresse email est gérée par l'IT et ne peut pas être modifiée ici",
    "tooltip.profile.phone": "Votre numéro de téléphone de contact pour la coordination du parking et les notifications",
    "tooltip.profile.department": "Les informations de votre département sont gérées par les RH et ne peuvent pas être modifiées ici",
    "tooltip.profile.bio": "Description optionnelle visible par les autres utilisateurs selon les paramètres de confidentialité",
    "tooltip.profile.changePhoto": "Téléchargez une nouvelle photo de profil (JPG, PNG ou GIF, max 2MB)",
    
    "tooltip.security.twoFactor": "Activez l'authentification à deux facteurs pour une sécurité de compte renforcée",
    "tooltip.security.loginAlerts": "Recevez des notifications lorsque quelqu'un se connecte à votre compte depuis un nouvel appareil",
    "tooltip.security.profileVisibility": "Contrôlez quelles informations les autres utilisateurs peuvent voir dans votre profil",
    "tooltip.security.dataSharing": "Gérez comment vos données sont utilisées pour les améliorations système et les analyses",
    
    "tooltip.settings.language": "Choisissez votre langue préférée pour l'interface - les changements prennent effet immédiatement",
    "tooltip.settings.theme": "Sélectionnez votre apparence de thème préférée - sombre, clair, ou suivre votre paramètre système",

    // Info Popovers - Critical Information
    "info.security.deleteAccount.title": "Avertissement de Suppression de Compte",
    "info.security.deleteAccount.content": "Cette action supprime définitivement votre compte et TOUTES les données associées y compris les réservations, véhicules, entrées de liste d'attente et préférences. Cela ne peut pas être annulé. Tout l'historique des réservations passées et futures sera perdu.",
    "info.security.twoFactor.title": "Authentification à Deux Facteurs",
    "info.security.twoFactor.content": "Ajoute une couche de sécurité supplémentaire nécessitant à la fois un mot de passe et une vérification par téléphone/application. Recommandé pour les comptes avec des méthodes de paiement ou l'accès à des données de parking sensibles.",
    "info.security.profileVisibility.title": "Paramètres de Confidentialité du Profil",
    "info.security.profileVisibility.content": "Privé: Seul vous voyez vos informations. Employés BCI: Les collègues peuvent voir vos préférences de parking et coordonnées pour la coordination.",
    "info.security.contactSharing.title": "Partage d'Informations de Contact",
    "info.security.contactSharing.content": "Permet aux propriétaires/locataires de places de vous contacter directement pour la coordination du parking. La désactivation peut limiter les opportunités de réservation mais améliore la confidentialité.",
    "info.security.changePassword.title": "Changer le Mot de Passe",
    "info.security.changePassword.content": "Vous serez déconnecté de tous les appareils après avoir changé votre mot de passe. Assurez-vous d'utiliser un mot de passe fort et unique.",
    "info.security.exportData.title": "Exporter les Données Personnelles",
    "info.security.exportData.content": "Cela générera une sauvegarde complète de votre profil, réservations, véhicules et préférences au format JSON pour téléchargement.",
    
    "info.waitingList.priority.title": "Directives de Niveau de Priorité",
    "info.waitingList.priority.content": "Priorité Élevée: Réservée aux besoins d'accessibilité, conditions médicales, grossesse ou circonstances urgentes. Priorité Moyenne: Navetteurs réguliers avec des besoins cohérents. Priorité Faible: Exigences de parking occasionnelles ou flexibles.",
    "info.waitingList.consequences.title": "Important: Changements de Position",
    "info.waitingList.consequences.content": "La mise à jour de vos préférences peut changer votre position dans la liste d'attente. Les augmentations de priorité vous font monter, tandis que la baisse de priorité ou le changement de type de place peut vous faire descendre. Les changements sont effectifs immédiatement.",
    
    "info.vehicles.delete.title": "Avertissement de Suppression de Véhicule",
    "info.vehicles.delete.content": "Cela supprime définitivement le véhicule de votre profil. Toutes les réservations actives avec ce véhicule resteront valides, mais vous ne pourrez pas faire de nouvelles réservations jusqu'à ce que vous ajoutiez un autre véhicule.",

    // Profile UI Text
    "profile.profile": "Profil",
    "profile.loginPrompt": "Veuillez vous connecter pour voir votre profil.",
    "profile.fullName": "Nom Complet",
    "profile.emailAddress": "Adresse Email",
    "profile.phoneNumber": "Numéro de Téléphone",
    "profile.department": "Département",
    "profile.bio": "Bio (Optionnel)",
    "profile.bioPlaceholder": "Parlez-nous de vous...",
    "profile.photoFormat": "JPG, PNG ou GIF. Taille max 2MB.",
    "profile.user": "Utilisateur",
    "profile.loadingPreferences": "Chargement des préférences...",
    "profile.emailNotificationTypes": "Types de Notifications Email",
    "profile.managedByIT": "L'adresse email est gérée par l'IT et ne peut pas être modifiée ici.",
    "profile.managedByHR": "Les informations de votre département sont gérées par les RH et ne peuvent pas être modifiées ici.",
    "profile.saveChanges": "Enregistrer les Modifications",
    "profile.changePassword": "Changer le Mot de Passe",
    "profile.exportData": "Exporter les Données",
    "profile.deleteAccount": "Supprimer le Compte",
    "profile.changePhoto": "Changer la Photo",
    "profile.settings": "Gérez les paramètres de votre compte et les préférences de confidentialité",
    "profile.editProfile": "Modifier le Profil",

    // Profile Specific  
    "profile.assignedSpots": "Mes Places de Parking Assignées",
    "profile.spotsOwned": "{count} place{count !== '1' ? 's' : ''} de parking possédée{count !== '1' ? 's' : ''}",
    "profile.spotNumber": "Place {number}",
    "profile.noSpotsAssigned": "Aucune place de parking assignée",
    "profile.contactAdmin": "Contactez votre administrateur pour assigner des places de parking à votre compte",
    "profile.memberSince": "Membre depuis {date}",
    "profile.privacy": "Confidentialité et Sécurité",
    "profile.profileVisibility": "Visibilité du Profil",
    "profile.profileVisibilityDesc": "Qui peut voir les informations de votre profil",
    "profile.contactSharing": "Partage des Informations de Contact",
    "profile.contactSharingDesc": "Partagez vos informations de contact avec les propriétaires/locataires de places",
    "profile.bookingHistory": "Visibilité de l'Historique des Réservations",
    "profile.bookingHistoryDesc": "Permettre aux autres de voir vos statistiques de réservation",
    "profile.securitySettings": "Paramètres de Sécurité",
    "profile.twoFactor": "Authentification à Deux Facteurs",
    "profile.twoFactorDesc": "Ajoutez une couche de sécurité supplémentaire à votre compte",
    "profile.recentActivity": "Activité de Connexion Récente",
    "profile.lastLogin": "Dernière connexion : {date} à {time} (Session actuelle)",
    "profile.previousLogin": "Connexion précédente : {date} à {time}",
    "profile.enableTwoFactor": "Activer l'Authentification à Deux Facteurs",
    "profile.notEnabled": "Non Activé",
    "profile.bciEmployeesOnly": "Employés BCI Seulement",
    "profile.private": "Privé",
    "profile.accountActions": "Actions de Compte",
    "profile.changePasswordDesc": "Mettez à jour le mot de passe de votre compte pour une sécurité renforcée",
    "profile.exportDataDesc": "Téléchargez une copie de toutes vos données personnelles stockées dans le système",
    "profile.deleteAccountDesc": "Supprimez définitivement votre compte et toutes les données associées",

    // Form Placeholders
    "placeholder.selectSpotType": "Sélectionnez le type de place",
    "placeholder.selectBuilding": "Sélectionnez le bâtiment",
    "placeholder.selectPriority": "Sélectionnez la priorité",
    "placeholder.briefReason": "Brève raison pour le besoin de parking...",

    // Priority Levels
    "priority.high.label": "Priorité Élevée",
    "priority.high.description": "Besoin urgent dû à l'accessibilité, grossesse ou raisons médicales",
    "priority.medium.label": "Priorité Moyenne",
    "priority.medium.description": "Navetteur régulier avec des besoins de parking cohérents",
    "priority.low.label": "Priorité Faible",
    "priority.low.description": "Utilisation occasionnelle ou exigences de parking flexibles",

    // Building Options
    "building.a": "Bâtiment A - Campus Principal",
    "building.b": "Bâtiment B - Aile Est",
    "building.c": "Bâtiment C - Aile Ouest",
    "building.d": "Bâtiment D - Annexe",

    // Validation Messages
    "validation.spotTypeRequired": "Veuillez sélectionner un type de place préféré",
    "validation.buildingRequired": "Veuillez sélectionner un bâtiment préféré",
    "validation.priorityRequired": "Veuillez sélectionner un niveau de priorité",
    "validation.reasonMinLength": "Veuillez fournir une raison (au moins 10 caractères)",
    "validation.makeRequired": "La marque du véhicule est requise",
    "validation.modelRequired": "Le modèle du véhicule est requis",
    "validation.yearMin": "L'année doit être 1990 ou plus tard",
    "validation.yearMax": "L'année ne peut pas être dans le futur",
    "validation.licensePlateRequired": "La plaque d'immatriculation est requise",

    // Toast Messages
    "toast.enrollSuccess.title": "Inscription Réussie!",
    "toast.enrollSuccess.description": "Vous avez été ajouté à la liste d'attente. Vous serez notifié lorsqu'une place se libère.",
    "toast.enrollFailed.title": "Échec de l'Inscription",
    "toast.enrollFailed.description": "Échec de rejoindre la liste d'attente. Veuillez réessayer.",
    "toast.preferencesUpdated.title": "Préférences Mises à Jour",
    "toast.preferencesUpdated.description": "Vos préférences de liste d'attente ont été mises à jour avec succès.",
    "toast.updateFailed.title": "Échec de la Mise à Jour",
    "toast.updateFailed.description": "Échec de mise à jour des préférences. Veuillez réessayer.",
    "toast.removedFromList.title": "Retiré de la Liste d'Attente",
    "toast.removedFromList.description": "Vous avez été retiré avec succès de la liste d'attente.",
    "toast.cancellationFailed.title": "Échec de l'Annulation",
    "toast.cancellationFailed.description": "Échec de retrait de la liste d'attente. Veuillez réessayer.",
    "toast.vehicleAdded.title": "Véhicule Ajouté",
    "toast.vehicleAdded.description": "Votre véhicule a été ajouté avec succès.",
    "toast.vehicleAddFailed.title": "Échec d'Ajout du Véhicule",
    "toast.vehicleAddFailed.description": "Veuillez réessayer.",
    "toast.vehicleUpdated.title": "Véhicule Mis à Jour",
    "toast.vehicleUpdated.description": "Votre véhicule a été mis à jour avec succès.",
    "toast.vehicleUpdateFailed.title": "Échec de Mise à Jour du Véhicule",
    "toast.vehicleUpdateFailed.description": "Veuillez réessayer.",
    "toast.vehicleDeleted.title": "Véhicule Supprimé",
    "toast.vehicleDeleted.description": "Votre véhicule a été supprimé avec succès.",
    "toast.vehicleDeleteFailed.title": "Échec de Suppression du Véhicule",
    "toast.vehicleDeleteFailed.description": "Veuillez réessayer.",
    "toast.notificationUpdateFailed.title": "Échec de Mise à Jour des Préférences",
    "toast.notificationUpdateFailed.description": "Vos préférences de notification n'ont pas pu être sauvegardées. Veuillez réessayer.",
    "toast.leftWaitingList.title": "Quitté la Liste d'Attente",
    "toast.leftWaitingList.description": "Vous avez été retiré de la liste d'attente. Vous pouvez vous réinscrire à tout moment.",
    "toast.enrolledWaitingList.title": "Inscrit à la Liste d'Attente!",
    "toast.enrolledWaitingList.description": "Vous recevrez des notifications lorsque des places correspondant à vos préférences se libèrent.",
    "toast.alertsDisabled.title": "Alertes de Disponibilité Désactivées",
    "toast.alertsDisabled.description": "Vous ne recevrez pas de notifications push sur les places disponibles. Vous pouvez les réactiver à tout moment.",
    "toast.alertsEnabled.title": "Alertes de Disponibilité Activées!",
    "toast.alertsEnabled.description": "Vous recevrez des notifications instantanées lorsque vos places préférées deviennent disponibles. Ne ratez rien!",
    "toast.reportsAvailable.title": "Rapports Disponibles",
    "toast.reportsAvailable.description": "Consultez votre historique de réservations et analyses de parking.",

    // Info tooltips for icons
    "tooltip.info.profileVisibility": "Cliquez pour plus d'informations sur les paramètres de visibilité du profil",
    "tooltip.info.contactSharing": "Cliquez pour plus d'informations sur le partage des informations de contact",
    "tooltip.info.twoFactor": "Cliquez pour plus d'informations sur l'authentification à deux facteurs",
    "tooltip.info.priority": "Cliquez pour plus d'informations sur les directives de niveau de priorité",

    // Roles
    "role.admin": "Administrateur",
    "role.owner": "Propriétaire de Place",
    "role.renter": "Locataire",

    // Spot Types
    "spotType.regular": "Normale",
    "spotType.electric": "Électrique",
    "spotType.accessible": "Accessible",
    "spotType.teslaEv": "Tesla VE",
    "spotType.reserved": "Réservée",

    // Common
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.edit": "Modifier",
    "common.delete": "Supprimer",
    "common.loading": "Chargement...",
    "common.success": "Succès",
    "common.error": "Erreur",
    "common.saving": "Enregistrement...",
    "common.tryAgain": "Veuillez réessayer.",
    "common.recently": "Récemment",
    "common.active": "Actif",
    "common.inactive": "Inactif",
    "common.indoor": "Intérieur",
    "common.availableForSharing": "Disponible pour Partage",
    "common.canBeShared": "Peut être partagé",
    "common.optional": "Optionnel",
  }
}

// Language provider component
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('language')
      return (stored as Language) || 'en'
    }
    return 'en'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language)
    }
  }, [language])

  // Memoize the translation function for stable references
  const t = useCallback((key: string, params?: Record<string, string>): string => {
    const keys = key.split('.')
    let value: any = translations[language]
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        value = undefined
        break
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation missing for key: ${key} in language: ${language}`)
      return key
    }

    if (params) {
      return Object.entries(params).reduce((acc, [param, replacement]) => {
        return acc.replace(new RegExp(`{${param}}`, 'g'), replacement)
      }, value)
    }

    return value
  }, [language])

  // Memoize the context value for stable reference and HMR compatibility
  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t])

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

