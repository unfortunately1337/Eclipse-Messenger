import type { Locale } from "@/lib/i18n/locale";

type LegalText = Record<Locale, string>;
type LegalSection = {
  title: LegalText;
  paragraphs: readonly LegalText[];
  links?: readonly { label: LegalText; href: string }[];
};

export const LEGAL_REVISION = "2026-10-21";
export const legalRevisionLabel: LegalText = {
  ru: "Редакция от 21 октября 2026 года",
  en: "Last updated October 21, 2026",
};

const repository = "https://github.com/unfortunately1337/Eclipse-Messenger";

// Both entry points render these full documents, including both language versions.
export const legalDocuments: readonly { title: LegalText; sections: readonly LegalSection[] }[] = [
  {
    title: { ru: "Условия использования Eclipse", en: "Eclipse Terms of Use" },
    sections: [
      {
        title: { ru: "1. О сервисе и принятии условий", en: "1. The service and acceptance" },
        paragraphs: [
          {
            ru: "Эти условия регулируют использование мессенджера Eclipse на eclpse.ru. Регистрируясь, вы принимаете условия и подтверждаете, что ознакомились с политикой конфиденциальности ниже. Если вы не согласны, не создавайте аккаунт и прекратите использование сервиса. Используйте Eclipse, если вы вправе принять эти условия по применимому к вам законодательству; при необходимости получите согласие законного представителя.",
            en: "These terms govern use of the Eclipse messenger at eclpse.ru. By registering, you accept the terms and acknowledge that you have read the privacy policy below. If you disagree, do not create an account and stop using the service. Use Eclipse if you are eligible to accept these terms under the laws that apply to you; obtain a legal representative's consent where required.",
          },
          {
            ru: "Берегите пароль, доступ к электронной почте, коды входа, средства двухфакторной защиты и токены ботов. Проверяйте активные сессии и завершайте незнакомые. Восстановление зависит от доступных способов подтверждения и сохранности ключей; восстановление любой переписки не гарантируется.",
            en: "Protect your password, access to your email, sign-in codes, two-factor authentication methods and bot tokens. Review active sessions and end unfamiliar ones. Recovery depends on available verification methods and retained keys; recovery of every conversation is not guaranteed.",
          },
        ],
      },
      {
        title: { ru: "2. Допустимое использование", en: "2. Acceptable use" },
        paragraphs: [
          {
            ru: "Не используйте сервис для мошенничества, фишинга, спама, угроз, травли, распространения материалов сексуальной эксплуатации детей или вредоносного ПО, публикации чужих личных данных без законного основания и других действий, нарушающих применимое право и права людей.",
            en: "Do not use the service for fraud, phishing, spam, threats, harassment, distribution of child sexual exploitation material or malware, publication of others' personal data without a lawful basis, or other conduct that violates applicable law or people's rights.",
          },
          {
            ru: "Запрещены несанкционированный доступ к чужим аккаунтам, сбор закрытых данных, обход ограничений и атаки на инфраструктуру. Боты и автоматизация через API допустимы при соблюдении прав доступа и ограничений частоты запросов. Изучать открытый код и проверять собственную локальную установку можно; тестирование рабочего сервиса с риском для других пользователей требует предварительного разрешения оператора.",
            en: "Unauthorized access to others' accounts, collection of private data, bypassing restrictions and attacks on the infrastructure are prohibited. Bots and API automation are allowed subject to permissions and rate limits. You may study the open-source code and test your own local installation; testing the live service in ways that could affect other users requires the operator's prior permission.",
          },
          {
            ru: "При злоупотреблениях или угрозе безопасности доступ к отдельным функциям либо сервису может быть ограничен. Администраторы групп и каналов устанавливают дополнительные правила своих сообществ в пределах этих условий.",
            en: "Access to individual features or the service may be restricted in response to abuse or security threats. Group and channel administrators may set additional community rules within these terms.",
          },
        ],
      },
      {
        title: { ru: "3. Ваши материалы и сторонние боты", en: "3. Your content and third-party bots" },
        paragraphs: [
          {
            ru: "Права на ваши сообщения и материалы остаются у вас или соответствующих правообладателей. Вы разрешаете обработку, хранение и передачу этих материалов в объёме, необходимом для выбранных вами функций сервиса. Публикуйте и отправляйте только то, на что у вас есть необходимые права.",
            en: "Rights to your messages and content remain with you or their respective rights holders. You permit processing, storage and delivery of that content as needed to provide the functions you choose. Only publish and send content for which you have the necessary rights.",
          },
          {
            ru: "Получатели могут сохранить, скопировать или переслать полученные материалы. Публичные публикации могут распространяться за пределами Eclipse. Сообщения и файлы, переданные стороннему боту, становятся доступны его разработчику; дальнейшая обработка зависит от правил этого разработчика. Подключение бота не делает его разработчика частью команды Eclipse.",
            en: "Recipients can save, copy or forward content they receive. Public posts may circulate outside Eclipse. Messages and files sent to a third-party bot become available to its developer; subsequent processing is subject to that developer's rules. Connecting a bot does not make its developer part of the Eclipse team.",
          },
        ],
      },
      {
        title: { ru: "4. Открытый исходный код", en: "4. Open source" },
        paragraphs: [
          {
            ru: "Eclipse — проект с открытым исходным кодом. Публичная редакция доступна на GitHub. Собственный код проекта в этом репозитории опубликован под GNU AGPL v3.0: его можно изучать, запускать, изменять и распространять при соблюдении лицензии. Для изменённых версий, предоставляемых пользователям по сети, действуют требования AGPL о предоставлении соответствующего исходного кода. Полные условия определяет LICENSE.",
            en: "Eclipse is an open-source project. Its public edition is available on GitHub. Eclipse-owned code in that repository is published under GNU AGPL v3.0: you may study, run, modify and redistribute it under the license. Modified versions offered to users over a network are subject to AGPL requirements to offer corresponding source. LICENSE contains the full terms.",
          },
          {
            ru: "Зависимости и сторонние ресурсы имеют собственные лицензии. Эти условия не отменяют права, предоставленные лицензиями. Лицензия на код сама по себе не предоставляет права на товарные знаки третьих лиц и не разрешает выдавать отдельную установку за официальный сервис. Открытость кода не означает публикацию пользовательских данных или секретов сервера.",
            en: "Dependencies and third-party resources have their own licenses. These terms do not override rights granted by licenses. A code license does not itself grant rights to third-party trademarks or permit presenting a separate installation as the official service. Open source does not mean publishing user data or server secrets.",
          },
        ],
        links: [
          { label: { ru: "Исходный код Eclipse", en: "Eclipse source code" }, href: repository },
          { label: { ru: "Лицензия GNU AGPL v3.0", en: "GNU AGPL v3.0 license" }, href: `${repository}/blob/main/LICENSE` },
          { label: { ru: "Сторонние компоненты и ресурсы", en: "Third-party components and resources" }, href: `${repository}/blob/main/THIRD_PARTY_NOTICES.md` },
        ],
      },
      {
        title: { ru: "5. Доступность и изменения условий", en: "5. Availability and changes to these terms" },
        paragraphs: [
          {
            ru: "Eclipse развивается: возможны ошибки, перерывы, изменение функций и потеря данных. Сервис предоставляется в доступном состоянии без обещания непрерывной работы или абсолютной защиты. Сохраняйте отдельные копии важных материалов. Ограничения гарантий и ответственности действуют только в пределах, разрешённых применимым правом. Условия не ограничивают права, которые нельзя отменить соглашением сторон.",
            en: "Eclipse is under active development: errors, outages, feature changes and data loss are possible. The service is provided as available, without a promise of uninterrupted operation or absolute protection. Keep separate copies of important content. Warranty and liability limitations apply only to the extent permitted by applicable law. These terms do not limit rights that cannot be waived by agreement.",
          },
          {
            ru: "Новая редакция условий публикуется на этой странице с датой обновления. Проверяйте её при существенных изменениях сервиса. Изменения не отменяют обязательства, возникшие до их вступления в силу. Для самостоятельных и сторонних установок оператор и правила обработки данных могут отличаться от eclpse.ru.",
            en: "Revised terms are published on this page with an updated date. Check them when the service changes substantially. Revisions do not remove obligations arising before they take effect. Self-hosted and third-party installations may have different operators and data practices from eclpse.ru.",
          },
        ],
      },
    ],
  },
  {
    title: { ru: "Политика конфиденциальности Eclipse", en: "Eclipse Privacy Policy" },
    sections: [
      {
        title: { ru: "1. Какие данные обрабатываются и зачем", en: "1. Data processed and its purposes" },
        paragraphs: [
          {
            ru: "Для регистрации, входа и восстановления доступа обрабатываются адрес электронной почты, хеш пароля и служебные данные подтверждения входа и двухфакторной защиты. Для работы профиля — идентификатор аккаунта, уникальные имена, отображаемое имя и выбранные вами аватар, баннер, описание, музыка и эмодзи-статус.",
            en: "Registration, sign-in and account recovery involve your email address, password hash and operational data for sign-in verification and two-factor authentication. Profile functions involve your account identifier, usernames, display name and any avatar, banner, description, music and emoji status you choose.",
          },
          {
            ru: "Для работы переписки обрабатываются сообщения и вложения, сведения об участниках и сообществах, добавленные вручную контакты, настройки, реакции, голоса в опросах, время отправки и служебные сведения о доставке и прочтении. Состав доступных другим пользователям данных зависит от функции и настроек приватности.",
            en: "Messaging involves messages and attachments, participant and community information, manually added contacts, settings, reactions, poll votes, sending times and delivery and read information. What other users can access depends on the feature and privacy settings.",
          },
          {
            ru: "Для управления сессиями, защиты от злоупотреблений и диагностики используются IP-адреса, сведения о браузере и устройстве, время активности и технические события. Нельзя считать, что IP-адреса никогда не сохраняются. Телефонный номер для регистрации не требуется; это не препятствует вам самостоятельно отправить его или другие личные данные в сообщении.",
            en: "Session management, abuse prevention and diagnostics use IP addresses, browser and device information, activity times and technical events. Do not assume IP addresses are never stored. Registration does not require a phone number; you can still choose to share one or other personal data in a message.",
          },
        ],
      },
      {
        title: { ru: "2. Шифрование и настройки приватности", en: "2. Encryption and privacy settings" },
        paragraphs: [
          {
            ru: "В Eclipse используются клиентское шифрование, серверное шифрование хранимых данных и механизмы резервного копирования и восстановления ключей. Обычные чаты, секретные чаты, группы, каналы и диалоги с ботами имеют разные режимы обработки и свойства конфиденциальности.",
            en: "Eclipse uses client encryption, server-side encryption of stored data, and key backup and recovery mechanisms. Ordinary chats, secret chats, groups, channels and bot conversations have different processing modes and confidentiality properties.",
          },
          {
            ru: "Текущая реализация включает серверное хранение и восстановление резервных копий приватных ключей с использованием серверных секретов. Поэтому Eclipse нельзя описывать как систему, в которой сервер технически никогда не может получить ключи или расшифровать данные. Не все данные профиля, метаданные и медиа защищены одинаковым способом.",
            en: "The current implementation includes server-side storage and recovery of private-key backups using server-held secrets. Eclipse therefore cannot be described as a system in which the server can technically never obtain keys or decrypt data. Profile data, metadata and media are not all protected in the same way.",
          },
          {
            ru: "Настройки управляют видимостью профиля, поиском, сетевой активностью и доступными способами связи, но не обеспечивают полной анонимности. Имя и уникальное имя меняются вручную; автоматическая смена никнейма сейчас не предоставляется. Шифрование не защищает от доступа к разблокированному или заражённому устройству и от сохранения материалов получателем. Открытый код сам по себе не является независимым аудитом безопасности.",
            en: "Settings control profile visibility, search, activity indicators and available ways to contact you, but do not provide complete anonymity. Display names and usernames can be changed manually; automatic nickname rotation is not currently provided. Encryption does not protect against access to an unlocked or compromised device or against a recipient saving content. Open-source code is not itself an independent security audit.",
          },
        ],
      },
      {
        title: { ru: "3. Хранение и удаление", en: "3. Retention and deletion" },
        paragraphs: [
          {
            ru: "История сообщений и вложения могут храниться на сервере после доставки для работы переписки и синхронизации сессий. Данные аккаунта, технические записи и кэш обрабатываются для соответствующих функций, безопасности и исполнения применимых обязанностей. Единого обещания немедленного или безвозвратного удаления всех копий нет.",
            en: "Message history and attachments may remain on the server after delivery to support conversations and session synchronization. Account data, technical records and caches are processed for their respective functions, security and applicable obligations. There is no blanket promise that all copies are deleted immediately or irreversibly.",
          },
          {
            ru: "Удаление сообщения действует в пределах выбранного действия и доступных вам прав: скрытие только у себя отличается от удаления для участников. Таймер секретного чата запускает удаление его данных на серверах Eclipse; выполнение очистки может занимать время. Удаление не отзывает копии, ранее сохранённые получателями или разработчиками ботов.",
            en: "Message deletion operates within the action you select and your permissions: hiding a message for yourself differs from deleting it for participants. A secret-chat timer initiates removal of its data from Eclipse servers; cleanup may take time. Deletion cannot revoke copies previously saved by recipients or bot developers.",
          },
          {
            ru: "Если оператор использует резервные копии, удалённые данные могут оставаться в них до очистки или перезаписи. Данные, которые необходимо хранить по применимому закону, могут сохраняться на соответствующем основании. Очистка кэша браузера не равнозначна удалению аккаунта или серверной истории.",
            en: "If the operator uses backups, deleted data may remain in them until cleanup or overwrite. Data required by applicable law may be retained on that basis. Clearing your browser cache does not delete your account or server-side history.",
          },
        ],
      },
      {
        title: { ru: "4. Cookies и данные на устройстве", en: "4. Cookies and data on your device" },
        paragraphs: [
          {
            ru: "Приложение использует cookies для авторизации, защиты запросов и выбора языка, а хранилища браузера — для настроек, черновиков, кэша и ключевого материала. Не все локальные записи дополнительно зашифрованы. На общем устройстве завершайте сессию и при необходимости очищайте данные сайта; это может удалить черновики и локальные ключи.",
            en: "The app uses cookies for authentication, request protection and language selection, and browser storage for settings, drafts, caches and key material. Not all local records have an additional encryption layer. On a shared device, sign out and clear site data if needed; this may remove drafts and local keys.",
          },
        ],
      },
      {
        title: { ru: "5. Получатели данных и инфраструктура", en: "5. Data recipients and infrastructure" },
        paragraphs: [
          {
            ru: "Выбранные вами материалы передаются адресатам и участникам соответствующих чатов. Видимость профиля и публичных публикаций зависит от настроек и типа сообщества. В зависимости от конфигурации установки используются хостинг, база данных, объектное хранилище, почтовые сервисы, Pusher для событий и push-уведомлений, сервисы защиты от автоматизированных запросов и доставки ресурсов. Их операторы могут обрабатывать необходимые технические данные; состав провайдеров и страны обработки зависят от развёртывания.",
            en: "Content you choose to share is delivered to recipients and participants in the relevant chats. Profile and public-post visibility depends on settings and community type. Depending on the installation's configuration, the service uses hosting, databases, object storage, email services, Pusher for events and push notifications, automated-request protection and resource-delivery services. Their operators may process necessary technical data; providers and processing countries depend on the deployment.",
          },
          {
            ru: "Если включены уведомления с предпросмотром, их содержимое может обрабатываться поставщиками доставки уведомлений. Раскрытие данных возможно при наличии применимой законной обязанности или в необходимом объёме для защиты сервиса и прав людей. Мы не обещаем техническую невозможность передачи данных при любых обстоятельствах.",
            en: "If notification previews are enabled, delivery providers may process their content. Data may be disclosed where an applicable legal obligation requires it or as necessary to protect the service and people's rights. We do not promise that disclosure is technically impossible under all circumstances.",
          },
        ],
      },
      {
        title: { ru: "6. Управление данными и обращения", en: "6. Data controls and enquiries" },
        paragraphs: [
          {
            ru: "В доступных настройках можно изменять профиль и приватность, управлять активными сессиями, очищать локальный кэш и удалять сообщения в пределах своих прав. Другие права на доступ, исправление и удаление данных определяются применимым законодательством; этот текст их не ограничивает.",
            en: "Available settings let you edit your profile and privacy choices, manage active sessions, clear local caches and delete messages within your permissions. Other access, correction and deletion rights are determined by applicable law; this text does not limit them.",
          },
          {
            ru: "Отдельный публичный контакт оператора для обращений по персональным данным пока не опубликован. GitHub Issues предназначены только для общих вопросов о проекте: не публикуйте там email аккаунта, переписку, пароли, токены и другие личные данные. Об уязвимостях сообщайте через закрытую форму GitHub, если она доступна; порядок указан в SECURITY.md. Эти каналы не заменяют личное обращение по данным аккаунта.",
            en: "A separate public operator contact for personal-data enquiries has not yet been published. GitHub Issues are for general project questions only: do not post account email addresses, conversations, passwords, tokens or other personal data there. Report vulnerabilities through GitHub's private form if available; SECURITY.md describes the process. These channels do not replace a private account-data enquiry channel.",
          },
        ],
        links: [
          { label: { ru: "Общие вопросы о проекте", en: "General project questions" }, href: `${repository}/issues` },
          { label: { ru: "Как сообщить об уязвимости", en: "Reporting a vulnerability" }, href: `${repository}/blob/main/SECURITY.md` },
        ],
      },
    ],
  },
];
