import React, { useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

export default function MaintenanceDiscussion({
    report,
    users = [],
    currentUserId,
    onSendChat,
    sendingChat = false
}) {
    const [chatMessage, setChatMessage] = useState('');
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    const handleChatChange = (e) => {
        const val = e.target.value;
        setChatMessage(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPosition);
        const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.]*)$/);

        if (lastAtMatch) {
            setShowMentionList(true);
            setMentionFilter(lastAtMatch[1]);
            setMentionIndex(0);
        } else {
            setShowMentionList(false);
        }
    };

    const handleSelectMention = (username) => {
        const input = document.getElementById('chat-input-maint');
        const cursorPosition = input ? input.selectionStart : chatMessage.length;
        const textBeforeCursor = chatMessage.slice(0, cursorPosition);
        const textAfterCursor = chatMessage.slice(cursorPosition);
        const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.]*)$/, `@${username} `);

        setChatMessage(newTextBefore + textAfterCursor);
        setShowMentionList(false);

        setTimeout(() => {
            if (input) {
                input.focus();
                input.setSelectionRange(newTextBefore.length, newTextBefore.length);
            }
        }, 0);
    };

    const handleChatKeyDown = (e) => {
        if (showMentionList) {
            const filteredUsers = users.filter(u => 
                (u.mentionName || '').toLowerCase().includes(mentionFilter.toLowerCase()) || 
                (u.name || '').toLowerCase().includes(mentionFilter.toLowerCase())
            );
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredUsers[mentionIndex]) {
                    handleSelectMention(filteredUsers[mentionIndex].mentionName);
                }
            } else if (e.key === 'Escape') {
                setShowMentionList(false);
            }
        } else {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitChat();
            }
        }
    };

    const submitChat = async () => {
        if (!chatMessage.trim() || sendingChat) return;
        const msg = chatMessage;
        setChatMessage('');
        await onSendChat(msg);
    };

    const renderChatMessage = (text) => {
        if (!text) return null;
        const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return (
                    <span key={i} className="font-bold text-blue-700 bg-blue-100 px-1 rounded mx-0.5">
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 flex flex-col shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <MessageSquare size={18} className="text-blue-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Diskusi & Riwayat Komunikasi
                </h3>
            </div>
            
            <div className="flex-1 space-y-3.5 overflow-y-auto max-h-80 pr-1">
                {report.progress && report.progress.length > 0 ? (
                    report.progress.map((msg, idx) => {
                        const isMine = msg.userId === currentUserId;
                        const isTechnician = msg.user?.role !== 'USER' && msg.user?.role !== 'ADMIN_UNIT';
                        
                        return (
                            <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`text-[10px] font-bold ${isMine ? 'text-blue-600' : (isTechnician ? 'text-orange-600' : 'text-slate-600')}`}>
                                        {isMine ? 'Anda' : (msg.user?.name || msg.user?.username)} {isTechnician && !isMine && '(Admin/Teknisi)'}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                        {new Date(msg.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs shadow-2xs ${
                                    isMine 
                                        ? 'bg-blue-600 text-white rounded-tr-xs' 
                                        : (isTechnician ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-xs' : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-xs')
                                }`}>
                                    <p className="whitespace-pre-wrap">{renderChatMessage(msg.message)}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-6 text-xs text-slate-400 italic">
                        Belum ada pesan diskusi.
                    </div>
                )}
            </div>

            <div className="flex items-end gap-2 pt-3 border-t border-slate-100 relative">
                {showMentionList && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50 flex flex-col max-h-48">
                        {users.filter(u => 
                            (u.mentionName || '').toLowerCase().includes(mentionFilter.toLowerCase()) || 
                            (u.name || '').toLowerCase().includes(mentionFilter.toLowerCase())
                        ).length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 italic text-center">User tidak ditemukan</div>
                        ) : (
                            users.filter(u => 
                                (u.mentionName || '').toLowerCase().includes(mentionFilter.toLowerCase()) || 
                                (u.name || '').toLowerCase().includes(mentionFilter.toLowerCase())
                            ).map((u, i) => (
                                <button
                                    key={u.id}
                                    onClick={() => handleSelectMention(u.mentionName)}
                                    className={`px-4 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${i === mentionIndex ? 'bg-blue-50' : ''}`}
                                >
                                    <div className="font-bold text-slate-800">{u.name}</div>
                                    <div className="text-[10px] text-slate-500">{u.username}</div>
                                </button>
                            ))
                        )}
                    </div>
                )}
                <textarea
                    id="chat-input-maint"
                    value={chatMessage}
                    onChange={handleChatChange}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Ketik pesan... (@username untuk mention)"
                    rows={1}
                    className="flex-1 max-h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                />
                <button
                    onClick={submitChat}
                    disabled={sendingChat || !chatMessage.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                    {sendingChat ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Kirim</span>
                </button>
            </div>
        </div>
    );
}
