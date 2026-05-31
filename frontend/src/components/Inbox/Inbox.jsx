// frontend/src/components/Inbox/Inbox.jsx
import React, { useEffect, useState } from 'react';
import { useConversationStore } from '../../store';
import ConversationList          from './ConversationList';
import ChatWindow                from '../Chat/ChatWindow';
import WhatsappPersonalPanel     from './WhatsappPersonalPanel';
import WhatsappBusinessPanel     from './WhatsappBusinessPanel';
import ConversationInfoPanel     from './ConversationInfoPanel';
import { PanelRight, Briefcase } from 'lucide-react';

export default function Inbox() {
  const { fetchConversations, activeConversation } = useConversationStore();
  const [showList, setShowList] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [inboxTab, setInboxTab] = useState('general');

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    if (activeConversation && window.innerWidth < 768) setShowList(false);
  }, [activeConversation]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* TABS */}
      <div className="flex border-b border-slate-200 bg-white flex-shrink-0">

        {/* Bandeja general */}
        <button
          onClick={() => setInboxTab('general')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${inboxTab === 'general'
              ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50'
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
          </svg>
          Bandeja general
        </button>

        {/* WhatsApp personal */}
        <button
          onClick={() => setInboxTab('personal')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${inboxTab === 'personal'
              ? 'text-green-600 border-green-500 bg-green-50/50'
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
          </svg>
          WhatsApp personal
        </button>

        {/* WhatsApp Business — NUEVO */}
        <button
          onClick={() => setInboxTab('business')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${inboxTab === 'business'
              ? 'text-blue-600 border-blue-500 bg-blue-50/50'
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <Briefcase size={15} />
          WA Business
        </button>

        {/* Toggle panel info — solo en general */}
        {inboxTab === 'general' && activeConversation && (
          <div className="ml-auto flex items-center pr-3">
            <button
              onClick={() => setShowInfo(!showInfo)}
              title={showInfo ? 'Ocultar panel' : 'Ver informacion'}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium
                ${showInfo
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                  : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
            >
              <PanelRight size={14} />
              Info
            </button>
          </div>
        )}
      </div>

      {/* CONTENIDO */}
      {inboxTab === 'general' ? (
        <div className="flex flex-1 overflow-hidden">

          {/* Lista de conversaciones */}
          <div className={`
            h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col
            transition-all duration-300
            md:w-80 md:flex
            ${showList ? 'w-full flex' : 'w-0 hidden md:w-80 md:flex'}
          `}>
            <ConversationList
              onSelectConversation={() => {
                if (window.innerWidth < 768) setShowList(false);
              }}
            />
          </div>

          {/* Chat */}
          <div className={`
            flex-1 flex flex-col h-full bg-slate-50 overflow-hidden
            ${showList ? 'hidden md:flex' : 'flex'}
          `}>
            {activeConversation && (
              <button
                onClick={() => setShowList(true)}
                className="md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200
                           text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                  <path fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd" />
                </svg>
                Volver a la bandeja
              </button>
            )}
            <ChatWindow />
          </div>

          {/* Panel de informacion lateral */}
          {activeConversation && showInfo && (
            <div className="hidden lg:flex flex-col h-full w-72 xl:w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden">
              <ConversationInfoPanel conversation={activeConversation} />
            </div>
          )}
        </div>

      ) : inboxTab === 'personal' ? (
        <div className="flex-1 overflow-hidden">
          <WhatsappPersonalPanel />
        </div>

      ) : (
        <div className="flex-1 overflow-hidden">
          <WhatsappBusinessPanel />
        </div>
      )}
    </div>
  );
}