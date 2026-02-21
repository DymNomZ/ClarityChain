// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VirtualClassroom {

    struct Course {
        uint id;
        string title;
        address teacher;    
        bool exists;        
    }

    // A Student's enrollment in a specific course
    struct Enrollment {
        string did;         // student ID string
        bool enrolled;
    }

    // One attendance entry per class session
    struct AttendanceRecord {
        uint sessionId;     
        bool present;
    }

    uint public courseCount = 0;

    // courseId => Course
    mapping(uint => Course) public courses;

    // courseId => list of student addresses
    mapping(uint => address[]) public courseStudents;

    // courseId => studentAddress => their enrollment info
    mapping(uint => mapping(address => Enrollment)) public enrollments;

    // courseId => studentAddress => their attendance records
    mapping(uint => mapping(address => AttendanceRecord[])) public attendance;

    // courseId => studentAddress => their grade (0-100)
    mapping(uint => mapping(address => uint)) public grades;

    // Teacher calls this to create a new course
    function createCourse(string memory _title) public {
        // increment course count. This is used as the course id
        courseCount++;
        // make new course
        courses[courseCount] = Course(courseCount, _title, msg.sender, true);
    }

    // Student calls this to join a course
    function enrollInCourse(uint _courseId, string memory _did) public {
        // require is like an exception in Java
        // check if the course does not exist
        require(courses[_courseId].exists, "Course does not exist");
        // check if the sender (the one who calls the function, which in this case is a student,
        /// is not already enrolled
        require(!enrollments[_courseId][msg.sender].enrolled, "Already enrolled");

        // create new enrollment with the student caller
        enrollments[_courseId][msg.sender] = Enrollment(_did, true);
        // add (push) the student to the course's list of students
        courseStudents[_courseId].push(msg.sender);
    }

    // Teacher calls this to mark who showed up
    function markAttendance(uint _courseId, address _student, uint _sessionId, bool _present) public {
        // make sure the caller is a teacher
        require(courses[_courseId].teacher == msg.sender, "Only the teacher can do this");
        // check if student is actually enrolled
        require(enrollments[_courseId][_student].enrolled, "Student is not enrolled");

        // mark the attendance
        attendance[_courseId][_student].push(AttendanceRecord(_sessionId, _present));
    }

    // Teacher calls this to give a grade
    function submitGrade(uint _courseId, address _student, uint _grade) public {
        // same shit
        require(courses[_courseId].teacher == msg.sender, "Only the teacher can do this");
        require(enrollments[_courseId][_student].enrolled, "Student is not enrolled");
        // cap to 100
        require(_grade <= 100, "Grade cannot exceed 100");

        // add grade
        grades[_courseId][_student] = _grade;
    }

    // Anyone can call this to view a student's grade
    function getGrade(uint _courseId, address _student) public view returns (uint) {
        require(enrollments[_courseId][_student].enrolled, "Student is not enrolled");
        return grades[_courseId][_student];
    }

    // Anyone can call this to view a studnet's attendances of a certain course
    function getStudentAttendance(uint _courseId, address _student) public view returns (AttendanceRecord[] memory) {
        require(enrollments[_courseId][_student].enrolled, "Student is not enrolled");
        return attendance[_courseId][_student];
    }

    // So that the teacher can view the list of students for that course
    function getCourseStudents(uint _courseId) public view returns (address[] memory) {
        require(courses[_courseId].exists, "Course does not exist");
        return courseStudents[_courseId];
    }

}