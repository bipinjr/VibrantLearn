// Client copy of supabase/seed/01_syllabus.sql for demo mode (same topics, weightage, minutes).
// Row: [unit, unitTitle, topic, weightage 1-10, difficulty 1-3, minutes, subtopics]
type Row = [number, string, string, number, number, number, string[]];

export type Topic = {
  subject: string;
  unit: number;
  unitTitle: string;
  topic: string;
  weightage: number;
  difficulty: number;
  minutes: number;
  subtopics: string[];
};

const RAW: Record<string, Row[]> = {
  "Java Programming": [
    [1, "Introduction to Java", "Features of Java and the JVM", 8, 1, 30, ["Platform independence", "JDK, JRE and JVM", "Bytecode"]],
    [1, "Introduction to Java", "Data types, variables and operators", 6, 1, 35, ["Primitive types", "Type casting", "Operator precedence"]],
    [1, "Introduction to Java", "Arrays and strings", 7, 2, 45, ["1D and 2D arrays", "String vs StringBuffer", "Common String methods"]],
    [2, "Classes and objects", "Classes, objects and methods", 9, 1, 40, ["Defining a class", "Creating objects", "Method overloading"]],
    [2, "Classes and objects", "Constructors and the this keyword", 9, 1, 35, ["Default and parameterised", "Constructor overloading", "this keyword"]],
    [2, "Classes and objects", "Static members and access specifiers", 7, 2, 30, ["static variables and methods", "public, private, protected, default"]],
    [3, "Inheritance and polymorphism", "Inheritance and its types", 10, 2, 45, ["Single, multilevel, hierarchical", "super keyword", "No multiple inheritance with classes"]],
    [3, "Inheritance and polymorphism", "Method overriding and dynamic dispatch", 10, 2, 45, ["Overriding rules", "Runtime polymorphism", "Overloading vs overriding"]],
    [3, "Inheritance and polymorphism", "Abstract classes and final", 8, 2, 35, ["abstract methods", "final variables, methods, classes"]],
    [3, "Inheritance and polymorphism", "Interfaces", 9, 2, 40, ["Defining and implementing", "Multiple inheritance with interfaces", "default methods"]],
    [3, "Inheritance and polymorphism", "Packages", 7, 2, 30, ["Creating packages", "import", "CLASSPATH"]],
    [4, "Exceptions and multithreading", "Exception handling", 10, 2, 45, ["try, catch, finally", "throw and throws", "Checked vs unchecked"]],
    [4, "Exceptions and multithreading", "Threads and the thread life cycle", 9, 3, 50, ["Thread class vs Runnable", "Thread states", "sleep, join"]],
    [4, "Exceptions and multithreading", "Synchronization", 7, 3, 40, ["synchronized methods and blocks", "wait, notify"]],
    [5, "Applets, AWT and I/O", "Event handling", 7, 2, 40, ["Delegation event model", "Listeners and adapters"]],
    [5, "Applets, AWT and I/O", "Streams and file handling", 7, 2, 40, ["Byte vs character streams", "FileReader and FileWriter"]],
  ],
  "Python Programming": [
    [1, "Python basics", "Data types, variables and operators", 7, 1, 35, ["int, float, str, bool", "Type conversion", "Operators"]],
    [1, "Python basics", "Control flow", 7, 1, 35, ["if-elif-else", "for and while", "break, continue, pass"]],
    [2, "Functions and modules", "Functions", 9, 2, 45, ["Positional, keyword, default arguments", "*args and **kwargs", "Return values"]],
    [2, "Functions and modules", "Scope, recursion and lambda", 8, 2, 40, ["Local vs global", "Recursive functions", "lambda, map, filter"]],
    [3, "Data structures in Python", "Strings", 7, 1, 35, ["Slicing", "String methods", "Formatting"]],
    [3, "Data structures in Python", "Lists and tuples", 10, 1, 45, ["List methods", "Comprehensions", "Tuple immutability"]],
    [3, "Data structures in Python", "Dictionaries and sets", 9, 2, 40, ["Dict methods", "Set operations"]],
    [4, "Files and exceptions", "File handling", 8, 2, 40, ["open modes", "with statement", "CSV files"]],
    [4, "Files and exceptions", "Exception handling", 9, 2, 40, ["try-except-else-finally", "raise", "Custom exceptions"]],
    [5, "Object-oriented Python", "Classes and objects", 9, 2, 40, ["__init__", "Instance vs class variables"]],
    [5, "Object-oriented Python", "Inheritance and polymorphism", 9, 2, 45, ["Single and multiple inheritance", "Method overriding", "super()"]],
  ],
  "Database Management Systems": [
    [1, "Introduction", "File system vs DBMS", 8, 1, 30, ["Drawbacks of file systems", "Advantages of DBMS"]],
    [1, "Introduction", "Three-schema architecture", 9, 2, 40, ["External, conceptual, internal", "Data independence"]],
    [2, "ER model", "Entities, attributes and relationships", 10, 2, 45, ["Attribute types", "Cardinality", "Participation"]],
    [2, "ER model", "ER diagrams", 10, 2, 50, ["Weak entities", "Drawing an ER diagram for a case"]],
    [2, "ER model", "Keys", 9, 1, 30, ["Super, candidate, primary, foreign"]],
    [3, "Relational model and SQL", "Relational algebra", 8, 3, 50, ["Select, project, join", "Set operations"]],
    [3, "Relational model and SQL", "SQL DDL and DML", 10, 1, 45, ["CREATE, ALTER, DROP", "INSERT, UPDATE, DELETE", "Constraints"]],
    [3, "Relational model and SQL", "SQL joins, grouping and subqueries", 10, 2, 60, ["Inner and outer joins", "GROUP BY, HAVING", "Nested queries"]],
    [4, "Normalization", "Functional dependencies", 8, 3, 45, ["Armstrong's axioms", "Closure"]],
    [4, "Normalization", "Normal forms 1NF to BCNF", 10, 3, 60, ["Anomalies", "1NF, 2NF, 3NF", "BCNF"]],
    [5, "Transactions", "ACID properties and transaction states", 10, 2, 40, ["Atomicity to durability", "State diagram"]],
    [5, "Transactions", "Concurrency control", 8, 3, 45, ["Lost update problem", "Two-phase locking"]],
  ],
  "Data Structures": [
    [1, "Introduction", "Types of data structures and complexity", 8, 2, 40, ["Linear vs non-linear", "Big O notation"]],
    [2, "Searching and sorting", "Linear and binary search", 9, 1, 35, ["Algorithm and complexity"]],
    [2, "Searching and sorting", "Bubble, selection and insertion sort", 9, 2, 45, ["Passes", "Complexity"]],
    [2, "Searching and sorting", "Merge sort and quick sort", 8, 3, 50, ["Divide and conquer", "Partitioning"]],
    [3, "Stacks and queues", "Stack operations", 10, 1, 35, ["Push, pop, peek", "Array implementation"]],
    [3, "Stacks and queues", "Applications of stacks", 10, 2, 50, ["Infix to postfix", "Postfix evaluation"]],
    [3, "Stacks and queues", "Queues and circular queues", 9, 2, 45, ["Enqueue, dequeue", "Circular queue"]],
    [4, "Linked lists", "Singly linked list", 10, 2, 55, ["Insert and delete at positions", "Traversal"]],
    [4, "Linked lists", "Doubly and circular linked lists", 8, 3, 45, ["Node structure", "Operations"]],
    [5, "Trees and graphs", "Binary trees and traversals", 10, 2, 50, ["Inorder, preorder, postorder"]],
    [5, "Trees and graphs", "Binary search trees", 9, 3, 50, ["Insert, delete, search"]],
    [5, "Trees and graphs", "Graph representation and traversal", 8, 3, 50, ["Adjacency matrix and list", "BFS and DFS"]],
  ],
  "Computer Networks": [
    [1, "Introduction", "Network types and topologies", 8, 1, 30, ["LAN, MAN, WAN", "Bus, star, ring, mesh"]],
    [1, "Introduction", "OSI and TCP/IP models", 10, 2, 50, ["Seven layers", "Comparison"]],
    [3, "Data link layer", "Error detection and correction", 9, 3, 50, ["Parity, CRC", "Hamming code"]],
    [4, "Network layer", "IP addressing and subnetting", 10, 3, 60, ["IPv4 classes", "Subnet masks"]],
    [4, "Network layer", "Routing algorithms", 8, 3, 45, ["Distance vector", "Link state"]],
    [5, "Transport layer", "TCP and UDP", 9, 2, 45, ["Three-way handshake", "Congestion control basics"]],
  ],
  "Operating Systems": [
    [2, "Process management", "Processes, PCB and process states", 10, 2, 40, ["State diagram", "Context switch"]],
    [2, "Process management", "CPU scheduling algorithms", 10, 3, 60, ["FCFS, SJF, priority, round robin", "Gantt charts"]],
    [3, "Synchronization and deadlocks", "Critical section and semaphores", 9, 3, 50, ["Race conditions", "Producer-consumer"]],
    [3, "Synchronization and deadlocks", "Deadlocks and the banker's algorithm", 10, 3, 60, ["Necessary conditions", "Banker's algorithm"]],
    [4, "Memory management", "Paging and segmentation", 9, 3, 50, ["Page tables", "Fragmentation"]],
    [4, "Memory management", "Virtual memory and page replacement", 10, 3, 55, ["Demand paging", "FIFO, LRU, optimal"]],
    [5, "File systems and disks", "Disk scheduling", 8, 2, 40, ["FCFS, SSTF, SCAN, C-SCAN"]],
  ],
};

export const SUBJECTS = Object.keys(RAW);

export function topicsFor(subject: string): Topic[] {
  return (RAW[subject] ?? []).map(([unit, unitTitle, topic, weightage, difficulty, minutes, subtopics]) => ({
    subject, unit, unitTitle, topic, weightage, difficulty, minutes, subtopics,
  }));
}
