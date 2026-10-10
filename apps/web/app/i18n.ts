export type Language = "en" | "es" | "ar";

export const languageOptions: Array<{
  value: Language;
  label: string;
  nativeLabel: string;
}> = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "es", label: "Spanish", nativeLabel: "Español" },
  { value: "ar", label: "Arabic", nativeLabel: "العربية" },
];

export const localeForLanguage: Record<Language, string> = {
  en: "en-US",
  es: "es-ES",
  ar: "ar-SA",
};

export const translations = {
  en: {
    common: {
      brandHome: "LUKAS Treasury home",
      chain: "Chain",
      language: "Language",
      loading: "Loading",
      ready: "Ready",
      connecting: "Connecting",
      trueValue: "true",
      falseValue: "false",
      unknown: "unknown",
      source: "Source",
      localToken: "Local token",
      bounded: "Bounded",
      allowlistedRecipient: "Allowlisted recipient",
      allowlistedAsset: "Allowlisted asset",
      signedCap: "Signed cap",
      decimals: "18 decimals",
      isoTime: "ISO-8601 with timezone",
      defaultsOneHour: "Defaults to one hour",
    },
    nav: {
      primary: "Primary navigation",
      overview: "Overview",
      obligations: "Obligations",
      controls: "Controls",
    },
    hero: {
      titleLine1: "Keep every",
      titleLine2: "commitment visible.",
      lede: "Schedule obligations in LUKAS. Settle in an allowlisted local-currency token, within terms you sign.",
      staticNotice: "Static demo · synthetic values · wallet actions disabled",
      mainnetNotice:
        "Celo mainnet · reviewed assets and oracle policy required",
      sepoliaNotice: "Celo Sepolia · synthetic test asset · no event credit",
      localNotice: "Local EVM · synthetic prices · SIMCOP mock token",
      runtimeNotice:
        "JACK-inspired runtime; upstream integration pending licensing.",
      statusLabel: "OPERATING STATUS",
      queueCount: "obligation in the operator queue",
      authorization: "Authorization",
      settlementRail: "Settlement rail",
    },
    actions: {
      connect: "Connect owner wallet",
      connected: "Wallet connected",
      staticDemo: "Read-only static demo",
      pause: "Pause treasury",
      resume: "Resume treasury",
      withdraw: "Prepare withdrawal",
      fund: "Prepare treasury funding",
      reviewTerms: "Review exact terms",
      sign: "Sign bounded obligation",
      parse: "Parse into review form",
      cancel: "Prepare cancellation",
      send: "Send reviewed owner transaction",
      verify: "Verify submitted owner transaction",
      resumeVerification: "Resume verification",
      allowRecipient: "Allow recipient",
      removeRecipient: "Remove recipient",
      tokenLimits: "Prepare token limits",
      sourcePolicy: "Prepare source freshness policy",
      executorRotation: "Prepare executor rotation",
    },
    metrics: {
      balance: "FUNDED TREASURY",
      balanceNote: "Read directly from the configured token contract",
      reference: "LUKAS REFERENCE VALUE",
      referenceNote: "basket · USD per reference unit",
      received: "SUPPLIER RECEIVED",
      receivedNote: "Balance observed on the configured chain",
      epoch: "POLICY EPOCH",
      paused: "Treasury is paused",
      active: "Settlement policy active",
    },
    compose: {
      schedule: "Schedule a supplier payment",
      scheduleDescription:
        "One recipient. One token. One maximum. A signature authorizes only these terms.",
      draftSummary: "Optional text draft · deterministic parser",
      explicitTerms: "Explicit payment terms",
      draftExample:
        "pay 1 LUKAS to 0x… max 500 SIMCOP due 2026-10-30T10:00:00-05:00 until 2026-10-30T11:00:00-05:00",
      draftHelp: "Produces a draft only. It cannot sign or send money.",
      lukas: "LUKAS denomination",
      maxSettlementLabel: (symbol: string) => `Maximum ${symbol} settlement`,
      settlement: "settlement",
      supplier: "Supplier wallet",
      token: "Settlement token",
      due: "Due time",
      expiry: "Expiry",
      reviewTitle: "Review before signing",
      quote: "Quote",
      validAfter: "Valid after",
      vaultRecipient: "Vault / recipient",
      deadline: "Deadline",
      quoteHelp:
        "Quote is indicative; execution uses a fresh accepted round within your signed cap.",
      methodology: "Methodology",
      walletHelp:
        "No browser wallet? Run pnpm demo:run to fund and sign with local-only test identities.",
    },
    queue: {
      title: "Obligations & receipts",
      description:
        "Every item carries its cap, state and chain-backed evidence.",
      empty: "No obligations yet. Create one or run the CLI demo.",
      settled: "Settled",
      unpaid: "Unpaid",
      chainReceipt: "Chain-backed receipt",
      transaction: "Transaction",
      block: "Block",
      recipient: "Recipient",
      oracleRound: "Oracle round",
      localEvidence:
        "Local transaction; no mainnet evidence, identity registration, or eligible attribution.",
      sepoliaEvidence: "Celo Sepolia test receipt; no mainnet event credit.",
      mainnetEvidence:
        "Celo mainnet receipt. Confirm the wallet, attribution and identity against the event registration.",
      unpaidReason: "Unpaid",
    },
    controls: {
      title: "Owner controls",
      description:
        "Only your wallet can pause, withdraw, cancel or change policy. A prepared action becomes effective after its successful chain transaction is verified.",
      fundingAmount: "Funding amount",
      withdrawalAmount: "Withdrawal amount",
      recipientsPolicy: "Recipients and policy",
      policyWarning:
        "Changing recipients, token limits, executor or source age invalidates existing authorizations. Review and sign replacement obligations after the change.",
      recipientToConfigure: "Recipient to configure",
      perPaymentLimit: "Per-payment token limit",
      dailyLimit: "Daily token limit",
      sourceAge: "Maximum source age (seconds)",
      executor: "Replacement executor",
      reviewTitle: "Review owner transaction",
      destination: "Destination",
      arguments: "Arguments",
      chain: "chain",
    },
    readiness: {
      title: "Operator readiness",
      description: "Evidence that the current policy can safely execute.",
      oldestComponent: "oldest component",
      stale: "STALE — execution blocked",
      fresh: "fresh",
      policyEpoch: "Policy epoch",
      paused: "paused",
      perPaymentCap: "per-payment cap",
      dailyCap: "daily cap",
      agent: "Agent",
      attribution: "Attribution",
      identity: "ERC-8004 identity",
      unregistered: "unregistered",
      eventNote:
        "Local/testnet transactions do not count toward the event. Mainnet requires reviewed asset/oracle provenance, identity and explicit operator authorization.",
    },
    footer: {
      text: "Powered by JACK principles · Owner controls custody · Daily caps reset at UTC midnight",
      mainnetOn: "Reviewed mainnet writes enabled",
      mainnetOff: "Mainnet writes disabled",
      release: "Release",
    },
    errors: {
      staticDemo: "This GitHub Pages build is a read-only static demo.",
      requestFailed: "Request failed",
      wallet: (chain: string | number) =>
        `Install an EVM wallet and connect to chain ${chain}.`,
      switchChain: (chain: string | number) =>
        `Switch your wallet to chain ${chain}`,
      switchBeforeSigning: (chain: string | number) =>
        `Switch to chain ${chain} before signing`,
      walletChanged: "Owner wallet changed; reconnect before signing",
      chainMismatch: "CHAIN_MISMATCH",
      pending: (hash: string) =>
        `Transaction pending: ${hash}; verify the chain result before retrying.`,
    },
  },
  es: {
    common: {
      brandHome: "Inicio de LUKAS Treasury",
      chain: "Cadena",
      language: "Idioma",
      loading: "Cargando",
      ready: "Listo",
      connecting: "Conectando",
      trueValue: "verdadero",
      falseValue: "falso",
      unknown: "desconocido",
      source: "Fuente",
      localToken: "Token local",
      bounded: "Limitada",
      allowlistedRecipient: "Destinatario permitido",
      allowlistedAsset: "Activo permitido",
      signedCap: "Límite firmado",
      decimals: "18 decimales",
      isoTime: "ISO-8601 con zona horaria",
      defaultsOneHour: "Una hora por defecto",
    },
    nav: {
      primary: "Navegación principal",
      overview: "Resumen",
      obligations: "Obligaciones",
      controls: "Controles",
    },
    hero: {
      titleLine1: "Mantén cada",
      titleLine2: "compromiso visible.",
      lede: "Programa obligaciones en LUKAS. Liquida en un token de moneda local permitido, dentro de los términos que firmas.",
      staticNotice:
        "Demo estática · valores sintéticos · acciones de billetera desactivadas",
      mainnetNotice:
        "Celo mainnet · activos revisados y política de oráculo requerida",
      sepoliaNotice:
        "Celo Sepolia · activo de prueba sintético · sin crédito en el evento",
      localNotice: "EVM local · precios sintéticos · token SIMCOP simulado",
      runtimeNotice:
        "Runtime inspirado en JACK; integración upstream pendiente de licencia.",
      statusLabel: "ESTADO OPERATIVO",
      queueCount: "obligación en la cola del operador",
      authorization: "Autorización",
      settlementRail: "Canal de liquidación",
    },
    actions: {
      connect: "Conectar billetera del propietario",
      connected: "Billetera conectada",
      staticDemo: "Demo estática de solo lectura",
      pause: "Pausar tesorería",
      resume: "Reanudar tesorería",
      withdraw: "Preparar retiro",
      fund: "Preparar financiación de tesorería",
      reviewTerms: "Revisar términos exactos",
      sign: "Firmar obligación limitada",
      parse: "Convertir en formulario de revisión",
      cancel: "Preparar cancelación",
      send: "Enviar transacción revisada del propietario",
      verify: "Verificar transacción enviada del propietario",
      resumeVerification: "Reanudar verificación",
      allowRecipient: "Permitir destinatario",
      removeRecipient: "Eliminar destinatario",
      tokenLimits: "Preparar límites del token",
      sourcePolicy: "Preparar política de frescura de fuente",
      executorRotation: "Preparar rotación del ejecutor",
    },
    metrics: {
      balance: "TESORERÍA FINANCIADA",
      balanceNote: "Leído directamente del contrato de token configurado",
      reference: "VALOR DE REFERENCIA LUKAS",
      referenceNote: "canasta · USD por unidad de referencia",
      received: "RECIBIDO POR PROVEEDOR",
      receivedNote: "Saldo observado en la cadena configurada",
      epoch: "ÉPOCA DE POLÍTICA",
      paused: "La tesorería está pausada",
      active: "Política de liquidación activa",
    },
    compose: {
      schedule: "Programar pago a proveedor",
      scheduleDescription:
        "Un destinatario. Un token. Un máximo. La firma autoriza solo estos términos.",
      draftSummary: "Borrador de texto opcional · analizador determinista",
      explicitTerms: "Términos de pago explícitos",
      draftExample:
        "pay 1 LUKAS to 0x… max 500 SIMCOP due 2026-10-30T10:00:00-05:00 until 2026-10-30T11:00:00-05:00",
      draftHelp: "Solo produce un borrador. No puede firmar ni enviar dinero.",
      lukas: "Denominación LUKAS",
      maxSettlementLabel: (symbol: string) => `Liquidación máxima de ${symbol}`,
      settlement: "liquidación",
      supplier: "Billetera del proveedor",
      token: "Token de liquidación",
      due: "Fecha de vencimiento",
      expiry: "Expiración",
      reviewTitle: "Revisar antes de firmar",
      quote: "Cotización",
      validAfter: "Válido después de",
      vaultRecipient: "Bóveda / destinatario",
      deadline: "Límite de tiempo",
      quoteHelp:
        "La cotización es indicativa; la ejecución usa una ronda aceptada reciente dentro de tu límite firmado.",
      methodology: "Metodología",
      walletHelp:
        "¿No tienes billetera de navegador? Ejecuta pnpm demo:run para financiar y firmar con identidades locales de prueba.",
    },
    queue: {
      title: "Obligaciones y recibos",
      description:
        "Cada elemento lleva su límite, estado y evidencia respaldada por la cadena.",
      empty: "Aún no hay obligaciones. Crea una o ejecuta la demo de CLI.",
      settled: "Liquidada",
      unpaid: "No pagada",
      chainReceipt: "Recibo respaldado por cadena",
      transaction: "Transacción",
      block: "Bloque",
      recipient: "Destinatario",
      oracleRound: "Ronda del oráculo",
      localEvidence:
        "Transacción local; sin evidencia de mainnet, registro de identidad ni atribución elegible.",
      sepoliaEvidence:
        "Recibo de prueba Celo Sepolia; sin crédito de evento en mainnet.",
      mainnetEvidence:
        "Recibo de Celo mainnet. Confirma la billetera, atribución e identidad contra el registro del evento.",
      unpaidReason: "No pagada",
    },
    controls: {
      title: "Controles del propietario",
      description:
        "Solo tu billetera puede pausar, retirar, cancelar o cambiar la política. Una acción preparada se hace efectiva después de verificar su transacción exitosa en la cadena.",
      fundingAmount: "Importe de financiación",
      withdrawalAmount: "Importe de retiro",
      recipientsPolicy: "Destinatarios y política",
      policyWarning:
        "Cambiar destinatarios, límites del token, ejecutor o antigüedad de la fuente invalida las autorizaciones existentes. Revisa y firma obligaciones de reemplazo después del cambio.",
      recipientToConfigure: "Destinatario a configurar",
      perPaymentLimit: "Límite de token por pago",
      dailyLimit: "Límite diario del token",
      sourceAge: "Antigüedad máxima de fuente (segundos)",
      executor: "Ejecutor de reemplazo",
      reviewTitle: "Revisar transacción del propietario",
      destination: "Destino",
      arguments: "Argumentos",
      chain: "cadena",
    },
    readiness: {
      title: "Estado del operador",
      description:
        "Evidencia de que la política actual puede ejecutarse de forma segura.",
      oldestComponent: "componente más antiguo",
      stale: "ANTIGUA — ejecución bloqueada",
      fresh: "actualizada",
      policyEpoch: "Época de política",
      paused: "pausada",
      perPaymentCap: "límite por pago",
      dailyCap: "límite diario",
      agent: "Agente",
      attribution: "Atribución",
      identity: "Identidad ERC-8004",
      unregistered: "no registrada",
      eventNote:
        "Las transacciones locales/de testnet no cuentan para el evento. Mainnet requiere procedencia revisada del activo/oráculo, identidad y autorización explícita del operador.",
    },
    footer: {
      text: "Basado en principios JACK · El propietario controla la custodia · Los límites diarios se reinician a medianoche UTC",
      mainnetOn: "Escrituras de mainnet revisadas activadas",
      mainnetOff: "Escrituras de mainnet desactivadas",
      release: "Versión",
    },
    errors: {
      staticDemo:
        "Esta compilación de GitHub Pages es una demo estática de solo lectura.",
      requestFailed: "La solicitud falló",
      wallet: (chain: string | number) =>
        `Instala una billetera EVM y conéctala a la cadena ${chain}.`,
      switchChain: (chain: string | number) =>
        `Cambia tu billetera a la cadena ${chain}`,
      switchBeforeSigning: (chain: string | number) =>
        `Cambia a la cadena ${chain} antes de firmar`,
      walletChanged:
        "La billetera del propietario cambió; vuelve a conectarla antes de firmar",
      chainMismatch: "DESAJUSTE_DE_CADENA",
      pending: (hash: string) =>
        `Transacción pendiente: ${hash}; verifica el resultado de la cadena antes de volver a intentarlo.`,
    },
  },
  ar: {
    common: {
      brandHome: "الصفحة الرئيسية لخزانة LUKAS",
      chain: "الشبكة",
      language: "اللغة",
      loading: "جارٍ التحميل",
      ready: "جاهز",
      connecting: "جارٍ الاتصال",
      trueValue: "نعم",
      falseValue: "لا",
      unknown: "غير معروف",
      source: "المصدر",
      localToken: "رمز محلي",
      bounded: "محددة",
      allowlistedRecipient: "المستلم المسموح به",
      allowlistedAsset: "الأصل المسموح به",
      signedCap: "الحد الموقّع",
      decimals: "18 منزلة عشرية",
      isoTime: "ISO-8601 مع المنطقة الزمنية",
      defaultsOneHour: "ساعة واحدة افتراضياً",
    },
    nav: {
      primary: "التنقل الرئيسي",
      overview: "نظرة عامة",
      obligations: "الالتزامات",
      controls: "التحكم",
    },
    hero: {
      titleLine1: "اجعل كل",
      titleLine2: "التزاماتك واضحة.",
      lede: "جدول الالتزامات في LUKAS. سوِّها برمز عملة محلية مسموح به، وفق الشروط التي توقّعها.",
      staticNotice: "عرض ثابت · قيم اصطناعية · إجراءات المحفظة معطلة",
      mainnetNotice:
        "شبكة Celo الرئيسية · الأصول المراجعة وسياسة أوراكل مطلوبة",
      sepoliaNotice:
        "شبكة Celo Sepolia · أصل اختبار اصطناعي · لا رصيد للفعالية",
      localNotice: "شبكة EVM محلية · أسعار اصطناعية · رمز SIMCOP تجريبي",
      runtimeNotice:
        "بيئة تشغيل مستوحاة من JACK؛ تكامل upstream بانتظار الترخيص.",
      statusLabel: "حالة التشغيل",
      queueCount: "التزام في قائمة المشغّل",
      authorization: "التفويض",
      settlementRail: "قناة التسوية",
    },
    actions: {
      connect: "توصيل محفظة المالك",
      connected: "المحفظة متصلة",
      staticDemo: "عرض ثابت للقراءة فقط",
      pause: "إيقاف الخزانة مؤقتاً",
      resume: "استئناف الخزانة",
      withdraw: "إعداد السحب",
      fund: "إعداد تمويل الخزانة",
      reviewTerms: "مراجعة الشروط الدقيقة",
      sign: "توقيع الالتزام المحدد",
      parse: "تحويل إلى نموذج المراجعة",
      cancel: "إعداد الإلغاء",
      send: "إرسال معاملة المالك المراجعة",
      verify: "التحقق من معاملة المالك المرسلة",
      resumeVerification: "استئناف التحقق",
      allowRecipient: "السماح بالمستلم",
      removeRecipient: "إزالة المستلم",
      tokenLimits: "إعداد حدود الرمز",
      sourcePolicy: "إعداد سياسة حداثة المصدر",
      executorRotation: "إعداد تدوير المنفذ",
    },
    metrics: {
      balance: "خزانة ممولة",
      balanceNote: "مقروء مباشرة من عقد الرمز المكوّن",
      reference: "قيمة LUKAS المرجعية",
      referenceNote: "سلة · الدولار لكل وحدة مرجعية",
      received: "المستلم من المورّد",
      receivedNote: "الرصيد المرصود على الشبكة المكوّنة",
      epoch: "حقبة السياسة",
      paused: "الخزانة متوقفة مؤقتاً",
      active: "سياسة التسوية مفعّلة",
    },
    compose: {
      schedule: "جدولة دفعة للمورّد",
      scheduleDescription:
        "مستلم واحد. رمز واحد. حد أقصى واحد. التوقيع يصرّح بهذه الشروط فقط.",
      draftSummary: "مسودة نصية اختيارية · محلل حتمي",
      explicitTerms: "شروط الدفع الصريحة",
      draftExample:
        "pay 1 LUKAS to 0x… max 500 SIMCOP due 2026-10-30T10:00:00-05:00 until 2026-10-30T11:00:00-05:00",
      draftHelp: "ينتج مسودة فقط. لا يمكنه التوقيع أو إرسال الأموال.",
      lukas: "فئة LUKAS",
      maxSettlementLabel: (symbol: string) => `الحد الأقصى لتسوية ${symbol}`,
      settlement: "التسوية",
      supplier: "محفظة المورّد",
      token: "رمز التسوية",
      due: "موعد الاستحقاق",
      expiry: "انتهاء الصلاحية",
      reviewTitle: "مراجعة قبل التوقيع",
      quote: "السعر التقديري",
      validAfter: "صالح بعد",
      vaultRecipient: "الخزنة / المستلم",
      deadline: "الموعد النهائي",
      quoteHelp:
        "السعر التقديري إرشادي؛ التنفيذ يستخدم جولة مقبولة حديثة ضمن الحد الموقّع.",
      methodology: "المنهجية",
      walletHelp:
        "لا توجد محفظة متصفح؟ شغّل pnpm demo:run للتمويل والتوقيع بهويات اختبار محلية.",
    },
    queue: {
      title: "الالتزامات والإيصالات",
      description: "يحمل كل عنصر حده وحالته ودليله المدعوم بالشبكة.",
      empty: "لا توجد التزامات بعد. أنشئ التزاماً أو شغّل عرض CLI.",
      settled: "تمت التسوية",
      unpaid: "غير مدفوع",
      chainReceipt: "إيصال مدعوم بالشبكة",
      transaction: "المعاملة",
      block: "الكتلة",
      recipient: "المستلم",
      oracleRound: "جولة أوراكل",
      localEvidence:
        "معاملة محلية؛ لا دليل من الشبكة الرئيسية أو تسجيل هوية أو إسناد مؤهل.",
      sepoliaEvidence:
        "إيصال اختبار Celo Sepolia؛ لا رصيد لفعالية الشبكة الرئيسية.",
      mainnetEvidence:
        "إيصال Celo الرئيسية. أكّد المحفظة والإسناد والهوية مقابل تسجيل الفعالية.",
      unpaidReason: "غير مدفوع",
    },
    controls: {
      title: "تحكم المالك",
      description:
        "محفظتك وحدها تستطيع إيقاف الخزانة أو السحب أو الإلغاء أو تغيير السياسة. تصبح العملية المعدة فعّالة بعد التحقق من نجاح معاملتها على الشبكة.",
      fundingAmount: "مبلغ التمويل",
      withdrawalAmount: "مبلغ السحب",
      recipientsPolicy: "المستلمون والسياسة",
      policyWarning:
        "تغيير المستلمين أو حدود الرمز أو المنفذ أو عمر المصدر يلغي التفويضات الحالية. راجع ووقّع التزامات بديلة بعد التغيير.",
      recipientToConfigure: "المستلم المراد تهيئته",
      perPaymentLimit: "حد الرمز لكل دفعة",
      dailyLimit: "الحد اليومي للرمز",
      sourceAge: "الحد الأقصى لعمر المصدر (بالثواني)",
      executor: "منفذ الاستبدال",
      reviewTitle: "مراجعة معاملة المالك",
      destination: "الوجهة",
      arguments: "المعاملات",
      chain: "الشبكة",
    },
    readiness: {
      title: "جاهزية المشغّل",
      description: "دليل على أن السياسة الحالية يمكن تنفيذها بأمان.",
      oldestComponent: "أقدم مكوّن",
      stale: "قديم — التنفيذ متوقف",
      fresh: "حديث",
      policyEpoch: "حقبة السياسة",
      paused: "متوقفة",
      perPaymentCap: "حد كل دفعة",
      dailyCap: "الحد اليومي",
      agent: "الوكيل",
      attribution: "الإسناد",
      identity: "هوية ERC-8004",
      unregistered: "غير مسجلة",
      eventNote:
        "المعاملات المحلية/التجريبية لا تُحتسب للفعالية. تتطلب الشبكة الرئيسية مصدر أصل/أوراكل مراجعاً وهوية وتفويضاً صريحاً من المشغّل.",
    },
    footer: {
      text: "مدعوم بمبادئ JACK · المالك يتحكم بالحفظ · تُعاد الحدود اليومية عند منتصف الليل بالتوقيت العالمي",
      mainnetOn: "كتابات الشبكة الرئيسية المراجعة مفعّلة",
      mainnetOff: "كتابات الشبكة الرئيسية معطّلة",
      release: "الإصدار",
    },
    errors: {
      staticDemo: "إصدار GitHub Pages هذا عرض ثابت للقراءة فقط.",
      requestFailed: "فشل الطلب",
      wallet: (chain: string | number) =>
        `ثبّت محفظة EVM واتصل بالشبكة ${chain}.`,
      switchChain: (chain: string | number) =>
        `بدّل محفظتك إلى الشبكة ${chain}`,
      switchBeforeSigning: (chain: string | number) =>
        `بدّل إلى الشبكة ${chain} قبل التوقيع`,
      walletChanged: "تغيّرت محفظة المالك؛ أعد الاتصال قبل التوقيع",
      chainMismatch: "عدم_تطابق_الشبكة",
      pending: (hash: string) =>
        `المعاملة معلّقة: ${hash}؛ تحقّق من نتيجة الشبكة قبل إعادة المحاولة.`,
    },
  },
} as const;

export type Translation = (typeof translations)["en"];

export function formatDate(timestamp: number, language: Language) {
  return new Intl.DateTimeFormat(localeForLanguage[language], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(timestamp));
}

export function translatedMode(mode: string | undefined, language: Language) {
  if (!mode) return translations[language].common.connecting;
  if (language === "en") return mode;
  const modes: Record<Language, Record<string, string>> = {
    en: {},
    es: {
      SIMULATION: "SIMULACIÓN",
      "STATIC DEMO": "DEMO ESTÁTICA",
      SIMULATION_MODE: "SIMULACIÓN",
    },
    ar: { SIMULATION: "محاكاة", "STATIC DEMO": "عرض ثابت" },
  };
  return modes[language][mode.toUpperCase()] ?? mode;
}

export function translatedTrustMode(mode: string, language: Language) {
  if (language === "en") return mode;
  const modes: Record<Language, Record<string, string>> = {
    en: {},
    es: { "SYNTHETIC DEMO": "DEMO SINTÉTICA" },
    ar: { "SYNTHETIC DEMO": "عرض اصطناعي" },
  };
  return modes[language][mode.toUpperCase()] ?? mode;
}

export function translatedIdentity(
  identity: string | undefined,
  language: Language,
) {
  if (!identity || language === "en") return identity;
  const identities: Record<Language, Record<string, string>> = {
    en: {},
    es: { "demo-only · not registered": "solo demo · no registrada" },
    ar: { "demo-only · not registered": "للعرض فقط · غير مسجلة" },
  };
  return identities[language][identity] ?? identity;
}

export function translatedState(state: string, language: Language) {
  const t = translations[language];
  if (state === "RECONCILED") return t.queue.settled;
  if (state === "BLOCKED")
    return language === "en"
      ? state
      : language === "es"
        ? "BLOQUEADA"
        : "متوقفة";
  if (state === "CANCELED")
    return language === "en"
      ? state
      : language === "es"
        ? "CANCELADA"
        : "ملغاة";
  if (state === "EXPIRED")
    return language === "en"
      ? state
      : language === "es"
        ? "EXPIRADA"
        : "منتهية";
  return state;
}
