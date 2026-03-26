#!/bin/bash
cd /home/kavia/workspace/code-generation/student-dashboard-platform-337012-337037/frontend_student_dashboard
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

