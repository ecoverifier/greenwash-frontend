"use client";
import React from 'react';
import { RiChatNewLine } from 'react-icons/ri';
import { FaTrashAlt } from 'react-icons/fa';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { User } from 'firebase/auth';

interface Report {
  id: string;
  company: string;
  report: any;
}

interface ReportsSidebarProps {
  reports: Report[];
  activeReportId: string | null;
  sessionStarted: boolean;
  user: User | null;
  onNewChat: () => void;
  onSelectReport: (report: Report) => void;
  onDeleteReport: (reportId: string) => void;
  onCloseSidebar?: () => void;
}

const ReportsSidebar: React.FC<ReportsSidebarProps> = ({
  reports,
  activeReportId,
  sessionStarted,
  user,
  onNewChat,
  onSelectReport,
  onDeleteReport,
  onCloseSidebar
}) => {
  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent onClick
    
    // Delete from Firestore for authenticated users
    if (user) {
      try {
        await deleteDoc(doc(db, "reports", reportId));
      } catch (error) {
        console.error("Error deleting report from Firestore:", error);
      }
    }
    
    // Call parent delete handler
    onDeleteReport(reportId);
  };

  const handleNewChat = () => {
    onNewChat();
    if (onCloseSidebar && typeof window !== 'undefined' && window.innerWidth < 768) {
      onCloseSidebar(); // Close sidebar on mobile after action
    }
  };

  const handleSelectReport = (report: Report) => {
    onSelectReport(report);
    if (onCloseSidebar && typeof window !== 'undefined' && window.innerWidth < 768) {
      onCloseSidebar(); // Close sidebar on mobile after selection
    }
  };

  return (
    <>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
          Reports
        </h2>
        {/* New Chat button */}
        <button
          disabled={!sessionStarted}
          onClick={handleNewChat}
          className={`inline-flex items-center gap-1 text-xs font-medium transition p-2 rounded-md ${
            sessionStarted
              ? "bg-stone-100 hover:bg-stone-200 text-emerald-600 hover:text-emerald-700"
              : "bg-stone-50 text-gray-300 cursor-not-allowed"
          }`}
          title="New Score"
        >
          <RiChatNewLine className="w-5 h-5" />
          Run New Search
        </button>
      </div>

      {/* Scrollable area for reports list */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Reports List */}
        <div className="flex-1 px-4 py-3 space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              onClick={() => handleSelectReport(r)}
              className={`group relative p-3 rounded-md text-sm cursor-pointer transition-all duration-200 shadow-sm ${
                r.id === activeReportId
                  ? "bg-gray-100 shadow-inner"
                  : "hover:bg-gray-50"
              }`}
            >
              <span className="block pr-6 font-medium text-sm text-gray-800 leading-tight truncate">
                {r.company}
              </span>

              {/* Trash icon for deleting reports */}
              <button
                onClick={(e) => handleDeleteReport(r.id, e)}
                className="absolute top-2.5 right-3 text-gray-400 hover:text-red-500 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title="Delete report"
              >
                <FaTrashAlt className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ReportsSidebar;